"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import {
  THEMES_DIR,
  THEME_NAME_RE,
  getThemeSchema,
  listThemes,
  setActiveTheme,
  readThemeManifest,
} from "@/lib/theme";
import AdmZip from "adm-zip";

// ---------- 主题管理（与插件商店同款校验管线；主题仅为 CSS，权限沿用外观设置） ----------
async function guardAppearance() {
  const user = await requireApiUser();
  if (!user) redirect("/login");
  if (!canManagePosts(user.role)) throw new Error("没有权限执行此操作");
  return user;
}

const MAX_THEME_ZIP_BYTES = 10 * 1024 * 1024;

/** 保存当前主题设置：只接受当前主题 schema 声明的 key，写入 settings theme:{key} */
export async function saveThemeSettings(values: Record<string, string>) {
  await guardAppearance();
  const active = await getActiveThemeName();
  const allowed = new Set(getThemeSchema(active).map((s) => s.key));
  const entries = Object.entries(values)
    .filter(([k]) => allowed.has(k))
    .map(([key, value]) => ({
      key: `theme:${key}`,
      value: String(value),
    }));

  await prisma.$transaction(
    entries.map(({ key, value }) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );
  revalidatePath("/", "layout");
  revalidatePath("/admin/appearance");
}

/** 切换当前主题 */
export async function activateTheme(name: string) {
  await guardAppearance();
  const { manifest, error } = readThemeManifest(name);
  if (!manifest) throw new Error(`无法启用：${error ?? "主题不可用"}`);
  await setActiveTheme(name);
  revalidatePath("/", "layout");
  revalidatePath("/admin/appearance");
}

/** 上传 zip 安装主题（应用商店 zip 包） */
export async function installThemeFromZip(formData: FormData) {
  await guardAppearance();
  const file = formData.get("zip");
  if (!(file instanceof File)) throw new Error("请选择 zip 文件");
  if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("请上传 .zip 文件");
  const buf = Buffer.from(await file.arrayBuffer());
  const m = await installFromBuffer(buf, `上传文件 ${file.name}`);
  return { ok: true, title: m.title, version: m.version };
}

/** 从 URL 下载 zip 安装 */
export async function installThemeFromUrl(url: string) {
  await guardAppearance();
  const u = String(url ?? "").trim();
  if (!/^https?:\/\//i.test(u)) throw new Error("仅支持 http(s) 下载地址");
  const res = await fetch(u, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`下载失败：HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const m = await installFromBuffer(buf, `URL ${u}`);
  return { ok: true, title: m.title, version: m.version };
}

/** 卸载主题：拒绝卸载当前主题；删除目录并清理该主题 schema 键的设置残留 */
export async function uninstallTheme(name: string) {
  await guardAppearance();
  const { manifest, error } = readThemeManifest(name);
  if (!manifest) throw new Error(`无法卸载：${error ?? "主题不可用"}`);
  if (name === (await getActiveThemeName())) {
    throw new Error("不能卸载当前正在使用的主题，请先切换到其他主题");
  }
  // 先计算要清理的设置键（此时目录还在），再删目录；只删该主题独有、其他主题不用的键（防误删共享键）
  const sharedKeys = new Set<string>();
  for (const other of listThemes().filter((n) => n !== name)) {
    for (const s of getThemeSchema(other)) sharedKeys.add(s.key);
  }
  const schemaKeys = getThemeSchema(name)
    .map((s) => `theme:${s.key}`)
    .filter((k) => !sharedKeys.has(k.slice("theme:".length)));
  const target = path.join(THEMES_DIR, name);
  await fs.promises.rm(target, { recursive: true, force: true });
  if (schemaKeys.length) {
    await prisma.setting.deleteMany({ where: { key: { in: schemaKeys } } });
  }
  revalidatePath("/admin/appearance");
}

async function getActiveThemeName(): Promise<string> {
  try {
    const row = await prisma.setting.findFirst({ where: { key: "active_theme" } });
    const v = row?.value ?? "";
    return v && THEME_NAME_RE.test(v) ? v : "default";
  } catch {
    return "default";
  }
}

/** 共享安装核心：校验 + 落地 + manifest 校验回滚（同插件商店管线） */
async function installFromBuffer(buf: Buffer, sourceLabel: string) {
  if (buf.length === 0 || buf.length > MAX_THEME_ZIP_BYTES) {
    throw new Error("zip 包大小不合法（上限 10MB）");
  }
  let zip: AdmZip;
  try {
    zip = new AdmZip(buf);
  } catch {
    throw new Error("不是有效的 zip 压缩包");
  }
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  if (!entries.length) throw new Error("zip 包为空");

  // 主题名 = 唯一的顶层目录名（zip 规范用正斜杠，但 Windows 工具可能产出反斜杠，统一规范化）
  const topDirs = new Set<string>();
  for (const e of entries) {
    const segs = e.entryName.replace(/\\/g, "/").split("/").filter(Boolean);
    if (segs.length) topDirs.add(segs[0]);
  }
  if (topDirs.size !== 1) throw new Error("主题包必须只含一个顶层目录（主题名）");
  const name = [...topDirs][0];
  if (!THEME_NAME_RE.test(name)) {
    throw new Error("主题名不合法（仅限小写字母/数字/下划线/连字符）");
  }

  // 防路径穿越：所有条目必须位于 {name}/ 下，且不含 .. / 盘符 / 空段
  for (const e of entries) {
    const raw = e.entryName.replace(/\\/g, "/");
    if (!raw.startsWith(name + "/")) throw new Error(`主题包含意外路径：${e.entryName}`);
    for (const seg of raw.split("/")) {
      if (seg === ".." || seg.includes(":") || seg === "") {
        throw new Error(`主题包含非法路径：${e.entryName}`);
      }
    }
  }

  const target = path.join(THEMES_DIR, name);
  if (fs.existsSync(target)) {
    throw new Error(`主题“${name}”已存在，请先在主题列表卸载后再安装`);
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
  const { manifest, error: manifestError } = readThemeManifest(name);
  if (!manifest) {
    await fs.promises.rm(target, { recursive: true, force: true }).catch(() => {});
    throw new Error(`安装失败：${manifestError ?? "manifest 无效"}（已回滚）`);
  }
  revalidatePath("/admin/appearance");
  return manifest;
}

// ---------- 主题设置导入（JSON 备份恢复；导出由客户端 Blob 生成） ----------
// 备份格式：{ format: "blogcms-theme-settings", theme, exportedAt, values: { key: value } }
export async function importThemeSettings(formData: FormData) {
  await guardAppearance();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("请选择 JSON 备份文件");
  if (!file.name.toLowerCase().endsWith(".json")) throw new Error("请上传 .json 文件");
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("备份文件不是合法 JSON");
  }
  const o = data as Record<string, unknown>;
  if (!o || typeof o !== "object" || typeof o.format !== "string") {
    throw new Error("备份文件格式错误");
  }
  if (o.format !== "blogcms-theme-settings") {
    throw new Error("不是本系统的主题设置备份文件");
  }
  const active = await getActiveThemeName();
  if (o.theme !== active) {
    throw new Error(`备份属于主题“${String(o.theme)}”，与当前主题“${active}”不一致`);
  }
  const rawValues = o.values as Record<string, unknown>;
  if (!rawValues || typeof rawValues !== "object" || Array.isArray(rawValues)) {
    throw new Error("备份缺少 values 字段");
  }

  // schema 白名单过滤：只接受当前主题声明的键，忽略外部键
  const allowed = new Set(getThemeSchema(active).map((s) => s.key));
  const entries: { key: string; value: string }[] = [];
  for (const [k, v] of Object.entries(rawValues)) {
    if (!allowed.has(k)) continue;
    entries.push({ key: `theme:${k}`, value: String(v) });
  }
  if (entries.length) {
    await prisma.$transaction(
      entries.map(({ key, value }) =>
        prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/appearance", "layout");
  return {
    imported: entries.length,
    total: Object.keys(rawValues).length,
  };
}
