import "server-only";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";

// ---------- 主题系统（对标 emlog themes/ 目录机制） ----------
// 目录约定：<项目根>/themes/{name}/，含 theme.json（manifest + 设置 schema）+ 可选 theme.css
// （覆盖 globals.css 的语义 CSS 变量，整体换肤；前台布局已全部用语义 token 类）。
// 设置值存 settings theme:{key}；当前主题记 active_theme（默认 "default"）。
// 主题不引入动态模板（RSC 无法动态加载 JSX 模块图），视觉切换靠 CSS 变量覆盖。
// 页面模板：主题可在 theme.json 声明 pageTemplates（纯 CSS 分发——前台渲染容器加
// data-page-template 属性，主题 CSS 用属性选择器定义布局差异）；动态 HTML 渲染模板
// 由插件提供（见 lib/plugin-pages.ts）。

// 设置字段类型（对标 WordPress CSF：color/switcher/radio/image + group 分组 + show_if 依赖）
export type SettingFieldType =
  | "text"
  | "textarea"
  | "checkbox"
  | "select"
  | "color"
  | "switcher"
  | "radio"
  | "image";

// 页面模板声明（对标 emlog page_*.php 自定义模板）：name 供前台分发与 DB 存储，title 为后台下拉显示名
export interface PageTemplateDecl {
  name: string;
  title: string;
  description?: string;
}

export interface ThemeSetting {
  key: string;
  label: string;
  type: SettingFieldType;
  options?: Record<string, string>; // select/radio: value -> 显示名
  default?: string;
  placeholder?: string;
  group?: string; // Tab 分组名，缺省 "常规"
  show_if?: { key: string; value: string }; // 等值依赖：依赖字段值匹配才显示
}

export interface ThemeManifest {
  name: string;
  title: string;
  version: string;
  description?: string;
  author?: string;
  pageTemplates?: PageTemplateDecl[];
}

export const THEMES_DIR = path.join(process.cwd(), "themes");
// 主题名白名单：小写字母/数字/下划线/连字符，防路径穿越
export const THEME_NAME_RE = /^[a-z0-9_-]{1,50}$/;
export const DEFAULT_THEME = "default";
// 页面模板名白名单 + 系统保留名（"default" 为默认渲染，不可被主题/插件占用）
export const PAGE_TEMPLATE_NAME_RE = /^[a-z0-9-]{1,40}$/;
export const RESERVED_PAGE_TEMPLATE = "default";

// ---------- 目录扫描与 manifest ----------
export function listThemes(): string[] {
  if (!fs.existsSync(THEMES_DIR)) return [];
  return fs
    .readdirSync(THEMES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && THEME_NAME_RE.test(d.name))
    .map((d) => d.name)
    .sort();
}

const SETTING_TYPES = new Set<SettingFieldType>([
  "text",
  "textarea",
  "checkbox",
  "select",
  "color",
  "switcher",
  "radio",
  "image",
]);

export function readThemeManifest(
  name: string
): { manifest: ThemeManifest | null; error?: string } {
  if (!THEME_NAME_RE.test(name)) return { manifest: null, error: "主题名不合法" };
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(THEMES_DIR, name, "theme.json"), "utf8");
  } catch {
    return { manifest: null, error: "缺少 theme.json" };
  }
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return { manifest: null, error: "theme.json 不是合法 JSON" };
  }
  if (!m || typeof m !== "object") return { manifest: null, error: "manifest 格式错误" };
  const o = m as Record<string, unknown>;
  if (typeof o.name !== "string" || !THEME_NAME_RE.test(o.name) || o.name !== name) {
    return { manifest: null, error: "name 缺失或与目录名不一致" };
  }
  if (typeof o.title !== "string" || typeof o.version !== "string") {
    return { manifest: null, error: "缺少 title 或 version" };
  }
  // 页面模板声明（可选）：name 白名单且不可占用系统保留名 "default"
  let pageTemplates: PageTemplateDecl[] | undefined;
  if (o.pageTemplates !== undefined) {
    if (!Array.isArray(o.pageTemplates)) {
      return { manifest: null, error: "pageTemplates 必须是数组" };
    }
    pageTemplates = [];
    for (const t of o.pageTemplates) {
      const to = t as Record<string, unknown>;
      if (
        typeof to.name === "string" &&
        PAGE_TEMPLATE_NAME_RE.test(to.name) &&
        to.name !== RESERVED_PAGE_TEMPLATE &&
        typeof to.title === "string"
      ) {
        pageTemplates.push({
          name: to.name,
          title: to.title,
          description: typeof to.description === "string" ? to.description : undefined,
        });
      }
    }
    if (pageTemplates.length === 0) return { manifest: null, error: "pageTemplates 声明无效" };
  }
  return {
    manifest: {
      name: o.name,
      title: o.title,
      version: o.version,
      description: typeof o.description === "string" ? o.description : undefined,
      author: typeof o.author === "string" ? o.author : undefined,
      pageTemplates,
    },
  };
}

/** 读取指定主题的 schema（主题名白名单校验） */
export function getThemeSchema(name: string): ThemeSetting[] {
  if (!THEME_NAME_RE.test(name)) return [];
  try {
    const raw = fs.readFileSync(path.join(THEMES_DIR, name, "theme.json"), "utf8");
    const data = JSON.parse(raw) as { settings?: unknown };
    if (!Array.isArray(data?.settings)) return [];
    const out: ThemeSetting[] = [];
    for (const s of data.settings) {
      if (!s || typeof s !== "object") continue;
      const so = s as Record<string, unknown>;
      if (
        typeof so.key === "string" &&
        typeof so.label === "string" &&
        typeof so.type === "string" &&
        SETTING_TYPES.has(so.type as SettingFieldType)
      ) {
        out.push({
          key: so.key,
          label: so.label,
          type: so.type as SettingFieldType,
          options: typeof so.options === "object" && so.options ? (so.options as Record<string, string>) : undefined,
          default: typeof so.default === "string" ? so.default : undefined,
          placeholder: typeof so.placeholder === "string" ? so.placeholder : undefined,
          group: typeof so.group === "string" ? so.group : undefined,
          show_if:
            so.show_if &&
            typeof so.show_if === "object" &&
            typeof (so.show_if as Record<string, unknown>).key === "string" &&
            typeof (so.show_if as Record<string, unknown>).value === "string"
              ? ((so.show_if as Record<string, unknown>) as { key: string; value: string })
              : undefined,
        });
      }
    }
    return out;
  } catch (err) {
    console.error(`[theme] ${name} theme.json 读取失败：`, err);
    return [];
  }
}

/** 当前激活主题的 schema（异步：先查 active_theme 再读文件） */
export async function getActiveThemeSchema(): Promise<ThemeSetting[]> {
  return getThemeSchema(await getActiveTheme());
}

/** 当前激活主题（settings active_theme，缺省 "default"） */
export async function getActiveTheme(): Promise<string> {
  try {
    const row = await prisma.setting.findFirst({ where: { key: "active_theme" } });
    const v = row?.value ?? "";
    return v && THEME_NAME_RE.test(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** 指定主题声明的页面模板列表（名字段已白名单校验，不含保留名） */
export function getThemePageTemplates(name: string): PageTemplateDecl[] {
  const { manifest } = readThemeManifest(name);
  return manifest?.pageTemplates ?? [];
}

/** 当前激活主题的页面模板列表 */
export async function getActiveThemePageTemplates(): Promise<PageTemplateDecl[]> {
  return getThemePageTemplates(await getActiveTheme());
}

/** 切换主题：写 active_theme（主题名白名单校验） */
export async function setActiveTheme(name: string): Promise<void> {
  if (!THEME_NAME_RE.test(name)) throw new Error("主题名不合法");
  await prisma.setting.upsert({
    where: { key: "active_theme" },
    update: { value: name },
    create: { key: "active_theme", value: name },
  });
}

/** 读取主题自定义 CSS（theme.css，可缺省；name 过白名单防穿越） */
export function getThemeCss(name: string): string {
  if (!THEME_NAME_RE.test(name)) return "";
  try {
    return fs.readFileSync(path.join(THEMES_DIR, name, "theme.css"), "utf8");
  } catch {
    return "";
  }
}

export async function getThemeDefaults(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const s of await getActiveThemeSchema()) {
    out[s.key] = s.default ?? (s.type === "checkbox" ? "0" : "");
  }
  return out;
}

/** 读取当前激活主题的设置值：schema 声明的键 = 默认值 + theme:{key} 已存值覆盖 */
export async function getThemeValues(): Promise<Record<string, string>> {
  const defaults = await getThemeDefaults();
  const keys = new Set(Object.keys(defaults));
  if (keys.size === 0) return defaults;
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { startsWith: "theme:" } },
    });
    for (const r of rows) {
      const k = r.key.slice("theme:".length);
      if (keys.has(k)) defaults[k] = r.value;
    }
  } catch {
    // 库不可用时退回默认值
  }
  return defaults;
}
