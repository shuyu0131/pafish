"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { canAdmin } from "@/lib/constants";
import { removeHooksByTag } from "@/lib/hooks";
import {
  PLUGINS_DIR,
  PLUGIN_NAME_RE,
  getActivePlugins,
  setActivePlugins,
  setPluginSettings,
  readManifest,
  runPluginLifecycle,
  registerPluginHooks,
} from "@/lib/plugin-loader";
import { refreshInjections } from "@/lib/plugin-injections";
import { refreshPluginPages } from "@/lib/plugin-pages";
import AdmZip from "adm-zip";

// ---------- 插件管理（仅管理员；插件代码拥有全站 node 权限，安装即信任） ----------
async function guardPluginAdmin() {
  const user = await requireApiUser();
  if (!user) redirect("/login");
  if (!canAdmin(user.role)) throw new Error("仅管理员可管理插件");
  return user;
}

/** 启用插件：注册钩子 + 生命周期 + 刷新注入缓存 */
export async function activatePlugin(name: string) {
  await guardPluginAdmin();
  if (!PLUGIN_NAME_RE.test(name)) throw new Error("插件名不合法");
  const { manifest, error } = readManifest(name);
  if (!manifest) throw new Error(`无法启用：${error ?? "manifest 无效"}`);

  const active = await getActivePlugins();
  if (!active.includes(name)) {
    active.push(name);
    await setActivePlugins(active);
  }
  await registerPluginHooks(name);
  await runPluginLifecycle(name, "activate");
  await refreshInjections();
  await refreshPluginPages();
  revalidatePath("/admin/plugins");
  revalidatePath("/");
}

/** 停用插件：注销其钩子 + 生命周期 + 刷新注入缓存 */
export async function deactivatePlugin(name: string) {
  await guardPluginAdmin();
  if (!PLUGIN_NAME_RE.test(name)) throw new Error("插件名不合法");

  const active = await getActivePlugins();
  await setActivePlugins(active.filter((n) => n !== name));
  removeHooksByTag(`plugin:${name}`);
  await runPluginLifecycle(name, "deactivate");
  await refreshInjections();
  await refreshPluginPages();
  revalidatePath("/admin/plugins");
  revalidatePath("/");
}

/** 卸载插件：停用清理 + 卸载回调 + 删除目录与数据 */
export async function uninstallPlugin(name: string) {
  await guardPluginAdmin();
  if (!PLUGIN_NAME_RE.test(name)) throw new Error("插件名不合法");

  const active = await getActivePlugins();
  await setActivePlugins(active.filter((n) => n !== name));
  removeHooksByTag(`plugin:${name}`);
  await runPluginLifecycle(name, "deactivate");
  await runPluginLifecycle(name, "uninstall");
  await prisma.setting.deleteMany({
    where: { key: { in: [`plugin_data:${name}`, `plugin_settings:${name}`] } },
  });
  await fs.promises.rm(path.join(PLUGINS_DIR, name), { recursive: true, force: true });
  await refreshInjections();
  await refreshPluginPages();
  revalidatePath("/admin/plugins");
  revalidatePath("/");
}

/** 保存插件设置（只接受 manifest schema 声明的 key；设置变化后刷新注入缓存） */
export async function savePluginSettings(name: string, values: Record<string, string>) {
  await guardPluginAdmin();
  if (!PLUGIN_NAME_RE.test(name)) throw new Error("插件名不合法");
  const { manifest, error } = readManifest(name);
  if (!manifest) throw new Error(`插件不可用：${error ?? "manifest 无效"}`);

  const allowed = new Set((manifest.settings ?? []).map((s) => s.key));
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (allowed.has(k)) clean[k] = String(v);
  }
  await setPluginSettings(name, clean);
  await refreshInjections();
  await refreshPluginPages();
  revalidatePath("/admin/plugins");
  revalidatePath(`/admin/plugins/${name}`);
  revalidatePath("/");
}

// ---------- 应用商店（本地安装，兼容商店分发 zip） ----------
// zip 结构约定：顶层目录 {插件名}/ 下含 plugin.json（可选 index.mjs）
const MAX_PLUGIN_ZIP_BYTES = 10 * 1024 * 1024; // 10MB

async function installFromBuffer(buf: Buffer, sourceLabel: string) {
  if (buf.length === 0 || buf.length > MAX_PLUGIN_ZIP_BYTES) {
    throw new Error(`插件包大小需在 10MB 以内（来源：${sourceLabel}）`);
  }
  let zip: AdmZip;
  try {
    zip = new AdmZip(buf);
  } catch {
    throw new Error("不是有效的 zip 压缩包");
  }
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  if (!entries.length) throw new Error("zip 包为空");

  // 插件名 = 唯一的顶层目录名（zip 规范用正斜杠，但 Windows 工具可能产出反斜杠，统一规范化）
  const topDirs = new Set<string>();
  for (const e of entries) {
    const segs = e.entryName.replace(/\\/g, "/").split("/").filter(Boolean);
    if (segs.length) topDirs.add(segs[0]);
  }
  if (topDirs.size !== 1) throw new Error("插件包必须只含一个顶层目录（插件名）");
  const name = [...topDirs][0];
  if (!PLUGIN_NAME_RE.test(name)) {
    throw new Error("插件名不合法（仅限小写字母/数字/下划线/连字符）");
  }

  // 防路径穿越：所有条目必须位于 {name}/ 下，且不含 .. / 盘符 / 空段
  for (const e of entries) {
    const raw = e.entryName.replace(/\\/g, "/");
    if (!raw.startsWith(name + "/")) throw new Error(`插件包含意外路径：${e.entryName}`);
    for (const seg of raw.split("/")) {
      if (seg === ".." || seg.includes(":") || seg === "") {
        throw new Error(`插件包含非法路径：${e.entryName}`);
      }
    }
  }

  const target = path.join(PLUGINS_DIR, name);
  if (fs.existsSync(target)) {
    throw new Error(`插件“${name}”已存在，请先在插件列表卸载后再安装`);
  }
  await fs.promises.mkdir(target, { recursive: true });

  // 逐条解压写入
  try {
    for (const e of entries) {
      const rel = e.entryName.replace(/\\/g, "/").slice(name.length + 1);
      const dest = path.join(target, rel);
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.writeFile(dest, zip.readFile(e));
    }
  } catch (err) {
    await fs.promises.rm(target, { recursive: true, force: true }).catch(() => {});
    throw new Error(`解压失败：${err instanceof Error ? err.message : "未知错误"}（已回滚）`);
  }

  // manifest 校验，防"装了个空壳"
  const { manifest, error } = readManifest(name);
  if (!manifest) {
    await fs.promises.rm(target, { recursive: true, force: true }).catch(() => {});
    throw new Error(`安装失败：${error ?? "manifest 无效"}（已回滚）`);
  }
  revalidatePath("/admin/plugins");
  return manifest;
}

/** 上传 zip 安装（应用商店 zip 包） */
export async function installPluginFromZip(formData: FormData) {
  await guardPluginAdmin();
  const file = formData.get("zip");
  if (!(file instanceof File)) throw new Error("请选择 zip 文件");
  if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("请上传 .zip 文件");
  const buf = Buffer.from(await file.arrayBuffer());
  const m = await installFromBuffer(buf, `上传文件 ${file.name}`);
  return { ok: true, title: m.title, version: m.version };
}

/** 从 URL 下载 zip 安装 */
export async function installPluginFromUrl(url: string) {
  await guardPluginAdmin();
  const trimmed = String(url ?? "").trim();
  if (!/^https?:\/\//i.test(trimmed)) throw new Error("URL 需以 http:// 或 https:// 开头");
  const res = await fetch(trimmed, {
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`下载失败（HTTP ${res.status}）`);
  const buf = Buffer.from(await res.arrayBuffer());
  const m = await installFromBuffer(buf, trimmed);
  return { ok: true, title: m.title, version: m.version };
}
