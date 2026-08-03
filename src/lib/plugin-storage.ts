import "server-only";
import {
  getActivePlugins,
  getPluginSettings,
  loadPluginModule,
  readManifest,
} from "@/lib/plugin-loader";

// ---------- 存储后端管线（对标注入/页面模板管线） ----------
// 激活插件中第一个「声明 storage 且导出 storeFile」的成为当前云存储后端：
//   storeFile(file, ctx) -> Promise<{ url: string } | null>  上传（返回 null 或抛错 = 拒绝，系统回退本地）
//   deleteFile(url, ctx) -> Promise<void>                    删除媒体（失败静默，不影响删除流程）
// ctx.getSettings() 实时读插件设置（每次上传/删除取最新值，改配置无需重启）。
// 插件代码只在 node runtime 动态加载；上传 API / 媒体删除 action 在此接入。
// 只有第一个声明的生效（多存储插件场景取激活列表顺序首个），停用/卸载即自动让位。

export interface CloudFileInput {
  buffer: Buffer;
  ext: string;
  mime: string;
  originalName: string;
  size: number;
  width: number | null;
  height: number | null;
}

/** 传给存储插件的最小上下文：读取插件自己的设置 */
export interface StoragePluginContext {
  getSettings: () => Promise<Record<string, string>>;
}

interface ActiveStorage {
  name: string;
  title: string;
  module: Record<string, unknown>;
}

/** 当前生效的云存储后端（无 = null） */
export async function getActiveStorage(): Promise<ActiveStorage | null> {
  const names = await getActivePlugins();
  for (const name of names) {
    const { manifest } = readManifest(name);
    if (!manifest?.storage) continue;
    const module = await loadPluginModule(name);
    if (!module || typeof module.storeFile !== "function") continue;
    return { name, title: manifest.storage.title, module };
  }
  return null;
}

/**
 * 上传到云存储：成功返回 { url }（完整公开 URL），
 * 无后端 / 插件拒绝 / 异常一律返回 null（调用方回退本地存储）。
 */
export async function storeToCloud(file: CloudFileInput): Promise<{ url: string } | null> {
  try {
    const backend = await getActiveStorage();
    if (!backend) return null;
    const ctx: StoragePluginContext = { getSettings: () => getPluginSettings(backend.name) };
    const fn = backend.module.storeFile as (
      f: CloudFileInput,
      ctx?: StoragePluginContext
    ) => Promise<{ url?: string } | string | null>;
    const res = await fn(file, ctx);
    const url =
      typeof res === "string" ? res : res && typeof res === "object" ? res.url : undefined;
    if (typeof url !== "string" || !url.trim()) return null;
    return { url: url.trim() };
  } catch (err) {
    console.error("[plugin-storage] 云存储上传失败，回退本地：", err);
    return null;
  }
}

/** 删除云端文件（仅当 url 为完整 http(s) URL 时调用；失败静默并记日志） */
export async function deleteFromCloud(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) return;
  try {
    const backend = await getActiveStorage();
    if (!backend || typeof backend.module.deleteFile !== "function") return;
    const ctx: StoragePluginContext = { getSettings: () => getPluginSettings(backend.name) };
    await (backend.module.deleteFile as (u: string, ctx?: StoragePluginContext) => Promise<void>)(
      url,
      ctx
    );
  } catch (err) {
    console.error(`[plugin-storage] 云端删除失败（忽略）：${url}`, err);
  }
}
