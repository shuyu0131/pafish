import "server-only";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { prisma } from "@/lib/db";
import { addHook } from "@/lib/hooks";
import { PAGE_TEMPLATE_NAME_RE, RESERVED_PAGE_TEMPLATE } from "@/lib/theme";

// ---------- 插件框架（对标 emlog content/plugins 目录即应用） ----------
// 目录约定：<项目根>/plugins/{name}/plugin.json + index.mjs（原生 ESM，零转译依赖）
// 插件代码只在 node runtime 动态加载（server action / route handler / 服务端工具），
// 前台 RSC 消费的内容走"注入管线"（lib/plugin-injections.ts：插件渲染 HTML -> settings -> RSC 读值）。

export const PLUGINS_DIR = path.join(process.cwd(), "plugins");
// 插件名白名单：小写字母/数字/下划线/连字符，防路径穿越
export const PLUGIN_NAME_RE = /^[a-z0-9_-]{1,50}$/;

export const INJECT_TARGETS = ["head", "footer", "sidebar"] as const;
export type InjectTarget = (typeof INJECT_TARGETS)[number];

export interface PluginSettingSchema {
  key: string;
  label: string;
  type: "text" | "textarea" | "checkbox" | "select" | "color" | "switcher" | "radio" | "image" | "password";
  options?: Record<string, string>; // select/radio: value -> 显示名
  default?: string;
  placeholder?: string;
  group?: string; // Tab 分组名，缺省 "常规"
  show_if?: { key: string; value: string }; // 等值依赖：依赖字段值匹配才显示
}

export interface PluginManifest {
  name: string;
  title: string;
  version: string;
  description?: string;
  author?: string;
  settings?: PluginSettingSchema[];
  injects?: InjectTarget[];
  /** 页面模板声明（对标 emlog page_*.php）：创建页面时下拉可选，模板渲染由 index.mjs 的 renderPageTemplate 提供 */
  pageTemplates?: { name: string; title: string }[];
  /** 插件前台页面声明（对标 emlog <alias>_show.php）：/plugin/<name>/<path> 访问 */
  pages?: { path: string; title: string }[];
  /** 存储后端声明：插件接管媒体上传（index.mjs 导出 storeFile/deleteFile，见 lib/plugin-storage.ts） */
  storage?: { title: string };
}

// 插件前台页面 path 白名单（单段路由，防路径穿越）
export const PLUGIN_PAGE_PATH_RE = /^[a-z0-9_-]{1,50}$/;

/** 插件上下文：插件代码可用的系统 API（不 import 系统模块，避免 TS/打包问题） */
export interface PluginContext {
  name: string;
  /** 注册事件钩子（对标 emlog doAction 点位），返回注销函数 */
  on: (name: string, fn: (...args: any[]) => unknown, priority?: number) => () => void;
  /** 读写插件自有数据（JSON 对象，存 settings plugin_data:{name}） */
  getData: () => Promise<Record<string, unknown>>;
  setData: (data: Record<string, unknown>) => Promise<void>;
  /** 读写插件设置（schema 表单配置，存 settings plugin_settings:{name}） */
  getSettings: () => Promise<Record<string, string>>;
  setSettings: (partial: Record<string, string>) => Promise<void>;
  /** 往插件数据追加一行日志（logs 数组，最多 50 条） */
  log: (message: string) => Promise<void>;
  /** 重新渲染前台注入缓存（设置变更后调用） */
  refreshInjections: () => Promise<void>;
}

// ---------- 目录扫描与 manifest ----------
export function listPluginDirs(): string[] {
  if (!fs.existsSync(PLUGINS_DIR)) return [];
  return fs
    .readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && PLUGIN_NAME_RE.test(d.name))
    .map((d) => d.name)
    .sort();
}

const SETTING_TYPES = new Set<PluginSettingSchema["type"]>([
  "text",
  "textarea",
  "checkbox",
  "select",
  "color",
  "switcher",
  "radio",
  "image",
  "password",
]);

export function readManifest(
  name: string
): { manifest: PluginManifest | null; error?: string } {
  if (!PLUGIN_NAME_RE.test(name)) return { manifest: null, error: "插件名不合法" };
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(PLUGINS_DIR, name, "plugin.json"), "utf8");
  } catch {
    return { manifest: null, error: "缺少 plugin.json" };
  }
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return { manifest: null, error: "plugin.json 不是合法 JSON" };
  }
  if (!m || typeof m !== "object") return { manifest: null, error: "manifest 格式错误" };
  const o = m as Record<string, unknown>;
  if (typeof o.name !== "string" || !PLUGIN_NAME_RE.test(o.name) || o.name !== name) {
    return { manifest: null, error: "name 缺失或与目录名不一致" };
  }
  if (typeof o.title !== "string" || typeof o.version !== "string") {
    return { manifest: null, error: "缺少 title 或 version" };
  }
  const settings: PluginSettingSchema[] = [];
  if (Array.isArray(o.settings)) {
    for (const s of o.settings) {
      if (!s || typeof s !== "object") continue;
      const so = s as Record<string, unknown>;
      if (
        typeof so.key === "string" &&
        typeof so.label === "string" &&
        typeof so.type === "string" &&
        SETTING_TYPES.has(so.type as PluginSettingSchema["type"])
      ) {
        settings.push({
          key: so.key,
          label: so.label,
          type: so.type as PluginSettingSchema["type"],
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
  }
  const injects: InjectTarget[] = Array.isArray(o.injects)
    ? (o.injects as unknown[]).filter((t): t is InjectTarget => INJECT_TARGETS.includes(t as InjectTarget))
    : [];
  // 页面模板声明（可选）：name 白名单且不可占用系统保留名 "default"
  let pageTemplates: { name: string; title: string }[] | undefined;
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
        pageTemplates.push({ name: to.name, title: to.title });
      }
    }
    if (pageTemplates.length === 0) return { manifest: null, error: "pageTemplates 声明无效" };
  }
  // 前台页面声明（可选）：path 白名单
  let pages: { path: string; title: string }[] | undefined;
  if (o.pages !== undefined) {
    if (!Array.isArray(o.pages)) {
      return { manifest: null, error: "pages 必须是数组" };
    }
    pages = [];
    for (const p of o.pages) {
      const po = p as Record<string, unknown>;
      if (typeof po.path === "string" && PLUGIN_PAGE_PATH_RE.test(po.path) && typeof po.title === "string") {
        pages.push({ path: po.path, title: po.title });
      }
    }
    if (pages.length === 0) return { manifest: null, error: "pages 声明无效" };
  }
  // 存储后端声明（可选）：对象且 title 为字符串才收，非法值忽略（不报错）
  let storage: { title: string } | undefined;
  if (o.storage !== undefined) {
    const so = o.storage as Record<string, unknown>;
    if (so && typeof so === "object" && typeof so.title === "string" && so.title) {
      storage = { title: so.title };
    }
  }
  return {
    manifest: {
      name: o.name,
      title: o.title,
      version: o.version,
      description: typeof o.description === "string" ? o.description : undefined,
      author: typeof o.author === "string" ? o.author : undefined,
      settings,
      injects,
      pageTemplates,
      pages,
      storage,
    },
  };
}

// ---------- 动态加载插件模块（webpackIgnore 让打包器跳过，运行期原生 import ESM） ----------
export async function loadPluginModule(name: string): Promise<Record<string, unknown> | null> {
  if (!PLUGIN_NAME_RE.test(name)) return null;
  const dir = path.join(PLUGINS_DIR, name);
  const indexFile = fs.existsSync(path.join(dir, "index.mjs"))
    ? "index.mjs"
    : fs.existsSync(path.join(dir, "index.js"))
      ? "index.js"
      : null;
  if (!indexFile) return null;
  const url = pathToFileURL(path.join(dir, indexFile)).href;
  try {
    const mod = (await import(/* webpackIgnore: true */ url)) as Record<string, unknown>;
    return mod;
  } catch (err) {
    console.error(`[plugins] 加载 ${name} 失败：`, err);
    return null;
  }
}

// ---------- 启用状态与插件数据（直接查库，避开 React cache 跨请求缓存） ----------
export async function getActivePlugins(): Promise<string[]> {
  try {
    const row = await prisma.setting.findFirst({ where: { key: "active_plugins" } });
    const list = row?.value ? JSON.parse(row.value) : [];
    return Array.isArray(list)
      ? list.filter((n): n is string => typeof n === "string" && PLUGIN_NAME_RE.test(n))
      : [];
  } catch {
    return [];
  }
}

export async function setActivePlugins(list: string[]): Promise<void> {
  const clean = [...new Set(list)].filter((n) => PLUGIN_NAME_RE.test(n));
  await prisma.setting.upsert({
    where: { key: "active_plugins" },
    update: { value: JSON.stringify(clean) },
    create: { key: "active_plugins", value: JSON.stringify(clean) },
  });
}

export async function getPluginData(name: string): Promise<Record<string, unknown>> {
  try {
    const row = await prisma.setting.findFirst({ where: { key: `plugin_data:${name}` } });
    const v = row?.value ? JSON.parse(row.value) : {};
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function setPluginData(name: string, data: Record<string, unknown>): Promise<void> {
  await prisma.setting.upsert({
    where: { key: `plugin_data:${name}` },
    update: { value: JSON.stringify(data) },
    create: { key: `plugin_data:${name}`, value: JSON.stringify(data) },
  });
}

export async function getPluginSettings(name: string): Promise<Record<string, string>> {
  try {
    const row = await prisma.setting.findFirst({ where: { key: `plugin_settings:${name}` } });
    const v = row?.value ? JSON.parse(row.value) : {};
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function setPluginSettings(
  name: string,
  partial: Record<string, string>
): Promise<void> {
  const cur = await getPluginSettings(name);
  await prisma.setting.upsert({
    where: { key: `plugin_settings:${name}` },
    update: { value: JSON.stringify({ ...cur, ...partial }) },
    create: { key: `plugin_settings:${name}`, value: JSON.stringify(partial) },
  });
}

// ---------- 插件上下文与生命周期 ----------
export function createPluginContext(name: string): PluginContext {
  return {
    name,
    on: (hookName, fn, priority = 10) => addHook(hookName, fn, priority, `plugin:${name}`),
    getData: () => getPluginData(name),
    setData: (data) => setPluginData(name, data),
    getSettings: () => getPluginSettings(name),
    setSettings: (partial) => setPluginSettings(name, partial),
    log: async (message) => {
      const data = await getPluginData(name);
      const logs = Array.isArray(data.logs) ? (data.logs as unknown[]) : [];
      logs.push({
        t: new Date().toISOString(),
        msg: String(message).slice(0, 500),
      });
      const trimmed = logs.slice(-50);
      await setPluginData(name, { ...data, logs: trimmed });
    },
    refreshInjections: async () => {
      const { refreshInjections } = await import("@/lib/plugin-injections");
      await refreshInjections();
    },
  };
}

/** 执行插件生命周期回调（激活/停用/卸载） */
export async function runPluginLifecycle(
  name: string,
  phase: "activate" | "deactivate" | "uninstall"
): Promise<void> {
  const mod = await loadPluginModule(name);
  const fnName =
    phase === "activate" ? "onActivate" : phase === "deactivate" ? "onDeactivate" : "onUninstall";
  const fn = mod?.[fnName];
  if (typeof fn === "function") {
    try {
      await (fn as (ctx: PluginContext) => unknown)(createPluginContext(name));
    } catch (err) {
      console.error(`[plugins] ${name} ${fnName} 失败：`, err);
    }
  }
}

/** 注册插件的事件钩子（激活时 + 服务器启动时对全部激活插件调用） */
export async function registerPluginHooks(name: string): Promise<void> {
  const mod = await loadPluginModule(name);
  const fn = mod?.registerHooks;
  if (typeof fn === "function") {
    try {
      await (fn as (ctx: PluginContext) => unknown)(createPluginContext(name));
    } catch (err) {
      console.error(`[plugins] ${name} registerHooks 失败：`, err);
    }
  }
}

/** 启动时预热：注册全部激活插件的钩子（进程重启后注册表为空，必须重新注册） */
export async function bootstrapPlugins(): Promise<void> {
  const active = await getActivePlugins();
  for (const name of active) {
    await registerPluginHooks(name);
  }
  const { refreshInjections } = await import("@/lib/plugin-injections");
  await refreshInjections();
  const { refreshPluginPages } = await import("@/lib/plugin-pages");
  await refreshPluginPages();
}
