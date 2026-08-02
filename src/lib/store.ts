import "server-only";
import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import AdmZip from "adm-zip";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { THEMES_DIR, THEME_NAME_RE, readThemeManifest } from "@/lib/theme";
import { PLUGINS_DIR, PLUGIN_NAME_RE, readManifest } from "@/lib/plugin-loader";

// ---------- 应用商店（主题市场 + 插件市场） ----------
// 商店源协议：源 = 基础 URL，提供 {base}/themes.json 与 {base}/plugins.json：
//   [{ name, title, version, description?, author?, zip, preview? }]
// 内置官方源（默认）：GitHub Pages 托管（github.io 服务器端可直连），store_url 留空即使用；
// 本地内置源（兜底）：public/store/*.json + zip 文件（fs 直读，无网络依赖），
//   远程源不可达/目录损坏时自动回退，商店页不会白屏；
// 自定义远程源：settings store_url 配置（http(s)），优先级高于内置官方源。
// 安装/更新管线与主题/插件页的 zip 安装同款校验（10MB / 唯一顶层目录 / 穿越防护），
// 独立维护以隔离"覆盖更新"语义（现有管线拒绝已存在目录，更新需要原子替换 + 回滚）。

export type StoreKind = "theme" | "plugin";

/** 内置官方商店（GitHub Pages），store_url 留空时默认使用 */
export const OFFICIAL_STORE_URL = "https://shuyu0131.github.io/pafish-store";

export interface StoreItem {
  name: string;
  title: string;
  version: string;
  description?: string;
  author?: string;
  zip: string;
  preview?: string;
}

export interface StoreCatalog {
  items: StoreItem[];
  base: string; // "" = 内置源
  error?: string;
}

const MAX_ZIP_BYTES = 10 * 1024 * 1024;
const STORE_DIR = path.join(process.cwd(), "public", "store");

/** 商店源地址：settings store_url（http(s) 才用）；留空 = 内置官方商店 */
export async function getStoreBaseUrl(): Promise<string> {
  try {
    const row = await prisma.setting.findFirst({ where: { key: "store_url" } });
    const v = (row?.value ?? "").trim();
    if (v && /^https?:\/\//i.test(v)) return v.replace(/\/+$/, "");
  } catch {
    // 库不可用时回退内置官方源
  }
  return OFFICIAL_STORE_URL;
}

/** 商店访问令牌：私有源鉴权（Authorization: Bearer）；仅远程源生效，公开源留空 */
export async function getStoreToken(): Promise<string> {
  try {
    const row = await prisma.setting.findFirst({ where: { key: "store_token" } });
    return (row?.value ?? "").trim();
  } catch {
    return "";
  }
}

/** 远程源请求头：配置了令牌则携带 Bearer（token 只在服务端 fetch，不暴露给浏览器） */
async function storeHeaders(token: string): Promise<Record<string, string>> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function authHint(status: number): string {
  return status === 401 || status === 403 ? "（令牌无效或源要求授权）" : "";
}

function kindDir(kind: StoreKind): string {
  return kind === "theme" ? THEMES_DIR : PLUGINS_DIR;
}

function kindNameRe(kind: StoreKind): RegExp {
  return kind === "theme" ? THEME_NAME_RE : PLUGIN_NAME_RE;
}

function kindFile(kind: StoreKind): string {
  return kind === "theme" ? "themes.json" : "plugins.json";
}

function kindLabel(kind: StoreKind): string {
  return kind === "theme" ? "主题" : "插件";
}

/** 简单版本比较：按 . 分段数字比较，容忍 v 前缀；a > b 返回 1，相等 0，a < b 返回 -1 */
export function compareVersions(a: string, b: string): number {
  const pa = String(a)
    .replace(/^v/i, "")
    .split(".")
    .map((s) => parseInt(s, 10) || 0);
  const pb = String(b)
    .replace(/^v/i, "")
    .split(".")
    .map((s) => parseInt(s, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/** 解析目录 JSON 并逐条校验过滤（JSON 非法/非数组抛错） */
function parseCatalog(raw: string, nameRe: RegExp): StoreItem[] {
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    throw new Error("目录不是合法 JSON");
  }
  if (!Array.isArray(arr)) throw new Error("目录格式错误");
  const items: StoreItem[] = [];
  for (const it of arr) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    if (
      typeof o.name === "string" &&
      nameRe.test(o.name) &&
      typeof o.title === "string" &&
      typeof o.version === "string" &&
      typeof o.zip === "string"
    ) {
      items.push({
        name: o.name,
        title: o.title,
        version: o.version,
        description: typeof o.description === "string" ? o.description : undefined,
        author: typeof o.author === "string" ? o.author : undefined,
        zip: o.zip,
        preview: typeof o.preview === "string" ? o.preview : undefined,
      });
    }
  }
  return items;
}

/** 读取本地内置商店目录（public/store，fs 直读；损坏时返回空） */
function readLocalCatalog(kind: StoreKind): StoreItem[] {
  try {
    return parseCatalog(fs.readFileSync(path.join(STORE_DIR, kindFile(kind)), "utf8"), kindNameRe(kind));
  } catch {
    return [];
  }
}

/**
 * 读取商店目录：远程源（官方默认 / 自定义）优先，失败自动回退本地内置商店并提示。
 * 返回 base 为远程地址（安装/更新按此拼接 zip 下载），回退时 base 为 ""（走 siteUrl 本地路径）。
 */
export async function fetchCatalog(kind: StoreKind): Promise<StoreCatalog> {
  const base = await getStoreBaseUrl();
  let fallbackHint = ""; // 远程失败原因，回退时展示

  if (base) {
    const label = base === OFFICIAL_STORE_URL ? "内置官方商店" : `远程商店“${base}”`;
    let raw: string | null = null;
    try {
      const headers = await storeHeaders(await getStoreToken());
      const res = await fetch(`${base}/${kindFile(kind)}`, {
        headers,
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        fallbackHint = `${label}目录获取失败：HTTP ${res.status}${authHint(res.status)}`;
      } else {
        raw = await res.text();
      }
    } catch (e) {
      fallbackHint = `${label}目录获取失败：${e instanceof Error ? e.message : "未知错误"}`;
    }
    if (raw !== null) {
      try {
        return { items: parseCatalog(raw, kindNameRe(kind)), base };
      } catch (e) {
        fallbackHint = `${label}${e instanceof Error ? e.message : "目录解析失败"}`;
      }
    }
  }

  // 回退：本地内置商店
  return {
    items: readLocalCatalog(kind),
    base: "",
    error: fallbackHint ? `${fallbackHint}，已回退内置商店（public/store）` : undefined,
  };
}

/** 本地已装版本（未安装返回 null） */
export function getInstalledVersion(kind: StoreKind, name: string): string | null {
  if (kind === "theme") {
    const { manifest } = readThemeManifest(name);
    return manifest?.version ?? null;
  }
  const { manifest } = readManifest(name);
  return manifest?.version ?? null;
}

/** 下载 zip：内置相对路径用 siteUrl 补全，远程拼源 base；私有源携带 Bearer 令牌 */
async function downloadZip(kind: StoreKind, zipUrl: string, base: string): Promise<Buffer> {
  const u = String(zipUrl).trim();
  let url: string;
  let headers: Record<string, string> = {};
  if (/^https?:\/\//i.test(u)) {
    url = u;
  } else if (base) {
    url = `${base}/${u.replace(/^\//, "")}`;
    headers = await storeHeaders(await getStoreToken());
  } else {
    url = siteUrl(u);
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`下载失败：HTTP ${res.status}${authHint(res.status)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_ZIP_BYTES) {
    throw new Error("zip 包大小不合法（上限 10MB）");
  }
  return buf;
}

/** zip 校验（同主题/插件安装管线）：唯一顶层目录 = 名称、穿越防护 */
function validateZip(kind: StoreKind, name: string, buf: Buffer): AdmZip {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buf);
  } catch {
    throw new Error("不是有效的 zip 压缩包");
  }
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  if (!entries.length) throw new Error("zip 包为空");

  const topDirs = new Set<string>();
  for (const e of entries) {
    const segs = e.entryName.replace(/\\/g, "/").split("/").filter(Boolean);
    if (segs.length) topDirs.add(segs[0]);
  }
  if (topDirs.size !== 1) throw new Error("安装包必须只含一个顶层目录");
  const top = [...topDirs][0];
  if (top !== name) throw new Error(`安装包顶层目录“${top}”与目标“${name}”不一致`);
  if (!kindNameRe(kind).test(top)) {
    throw new Error("安装包名称不合法（仅限小写字母/数字/下划线/连字符）");
  }
  for (const e of entries) {
    const raw = e.entryName.replace(/\\/g, "/");
    if (!raw.startsWith(top + "/")) throw new Error(`安装包含意外路径：${e.entryName}`);
    for (const seg of raw.split("/")) {
      if (seg === ".." || seg.includes(":") || seg === "") {
        throw new Error(`安装包含非法路径：${e.entryName}`);
      }
    }
  }
  return zip;
}

async function writeEntries(zip: AdmZip, name: string, target: string) {
  for (const e of zip.getEntries().filter((x) => !x.isDirectory)) {
    const rel = e.entryName.replace(/\\/g, "/").slice(name.length + 1);
    const dest = path.join(target, rel);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, zip.readFile(e));
  }
}

function revalidateStore(kind: StoreKind) {
  revalidatePath(kind === "theme" ? "/admin/appearance" : "/admin/plugins");
  revalidatePath("/admin/store");
}

/** 从商店安装（目标已存在则拒绝） */
export async function installFromStore(
  kind: StoreKind,
  name: string,
  base: string,
  zipUrl: string
): Promise<{ title: string; version: string }> {
  const dir = kindDir(kind);
  const target = path.join(dir, name);
  if (fs.existsSync(target)) {
    throw new Error(`${kindLabel(kind)}“${name}”已安装，可直接更新`);
  }
  const buf = await downloadZip(kind, zipUrl, base);
  const zip = validateZip(kind, name, buf);

  await fs.promises.mkdir(target, { recursive: true });
  try {
    await writeEntries(zip, name, target);
  } catch (err) {
    await fs.promises.rm(target, { recursive: true, force: true }).catch(() => {});
    throw new Error(`解压失败：${err instanceof Error ? err.message : "未知错误"}（已回滚）`);
  }
  // manifest 校验，防"装了个空壳"
  const manifest =
    kind === "theme" ? readThemeManifest(name).manifest : readManifest(name).manifest;
  if (!manifest) {
    await fs.promises.rm(target, { recursive: true, force: true }).catch(() => {});
    throw new Error(`安装失败：manifest 无效（已回滚）`);
  }
  revalidateStore(kind);
  return { title: manifest.title, version: manifest.version };
}

/** 从商店更新：原子覆盖（旧目录备份，失败回滚），设置保留不动 */
export async function updateFromStore(
  kind: StoreKind,
  name: string,
  base: string,
  zipUrl: string
): Promise<{ title: string; version: string }> {
  const dir = kindDir(kind);
  const target = path.join(dir, name);
  if (!fs.existsSync(target)) {
    throw new Error(`${kindLabel(kind)}“${name}”尚未安装，请先安装`);
  }
  const buf = await downloadZip(kind, zipUrl, base);
  const zip = validateZip(kind, name, buf);

  // 解压到临时目录（.tmp-/ .bak- 前缀天然不被 listThemes/listPluginDirs 扫描）
  const suffix = `${name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const tmp = path.join(dir, `.tmp-store-${suffix}`);
  await fs.promises.mkdir(tmp, { recursive: true });
  try {
    await writeEntries(zip, name, tmp);
  } catch (err) {
    await fs.promises.rm(tmp, { recursive: true, force: true }).catch(() => {});
    throw new Error(`解压失败：${err instanceof Error ? err.message : "未知错误"}（已回滚）`);
  }
  // 校验临时目录里的 manifest（name 与目标一致 + 基本字段）
  const manifestFile = path.join(tmp, kind === "theme" ? "theme.json" : "plugin.json");
  let m: { title: string; version: string } | null = null;
  try {
    const data = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as Record<string, unknown>;
    if (
      data &&
      typeof data === "object" &&
      data.name === name &&
      typeof data.title === "string" &&
      typeof data.version === "string"
    ) {
      m = { title: data.title, version: data.version };
    }
  } catch {
    // 落到 m === null
  }
  if (!m) {
    await fs.promises.rm(tmp, { recursive: true, force: true }).catch(() => {});
    throw new Error("更新包 manifest 无效（已回滚）");
  }

  // 原子替换：旧目录 → 备份；新目录 → 正式名；失败回滚
  const bak = path.join(dir, `.bak-store-${suffix}`);
  try {
    await fs.promises.rename(target, bak);
    await fs.promises.rename(tmp, target);
    await fs.promises.rm(bak, { recursive: true, force: true }).catch(() => {});
  } catch (err) {
    await fs.promises.rm(target, { recursive: true, force: true }).catch(() => {});
    await fs.promises.rename(bak, target).catch(() => {});
    throw new Error(`更新失败：${err instanceof Error ? err.message : "未知错误"}（已回滚）`);
  }
  revalidateStore(kind);
  return { title: m.title, version: m.version };
}
