import "server-only";

// ---------- 钩子引擎（对标 emlog $emHooks 机制） ----------
// 模块级注册表：钩子名 -> 有序回调列表
// 注意：本模块只在 node runtime（server action / route handler / 服务端工具）中使用。
// 前台 RSC 无法动态加载插件代码，需要前台内容的插件请走"注入管线"
// （lib/plugin-injections.ts：插件渲染 HTML -> 存 settings -> RSC 读值输出）。

type HookFn = (...args: any[]) => unknown;

interface HookEntry {
  fn: HookFn;
  priority: number;
  tag?: string; // 来源标记（如 plugin:demo），支持按来源批量注销
}

const registry = new Map<string, HookEntry[]>();

/** 注册钩子；priority 越小越先执行；tag 用于按来源批量注销（插件停用时） */
export function addHook(name: string, fn: HookFn, priority = 10, tag?: string): () => void {
  const list = registry.get(name) ?? [];
  list.push({ fn, priority, tag });
  list.sort((a, b) => a.priority - b.priority);
  registry.set(name, list);
  return () => removeHook(name, fn);
}

/** 按来源标记批量注销（如 removeHooksByTag("plugin:demo")） */
export function removeHooksByTag(tag: string): void {
  for (const [name, list] of registry) {
    const next = list.filter((e) => e.tag !== tag);
    if (next.length) registry.set(name, next);
    else registry.delete(name);
  }
}

export function removeHook(name: string, fn: HookFn): void {
  const list = registry.get(name);
  if (!list) return;
  const next = list.filter((e) => e.fn !== fn);
  if (next.length) registry.set(name, next);
  else registry.delete(name);
}

export function hasHook(name: string): boolean {
  return (registry.get(name)?.length ?? 0) > 0;
}

// ---------- 插件钩子懒注册 ----------
// 模块级注册表在 server action / route handler / instrumentation 等不同 bundle 中
// 各自实例化，互不共享。因此每个实例首次执行钩子时，需按 DB 中的激活插件列表
// 把插件钩子补注册到本实例的注册表（原生 import 的插件模块跨 bundle 共享缓存）。
let registeredPlugins = new Set<string>();
let lastEnsureCheck = 0;

export async function ensurePluginHooks(): Promise<void> {
  const now = Date.now();
  if (now - lastEnsureCheck < 5000) return; // 5 秒节流
  lastEnsureCheck = now;
  try {
    const { getActivePlugins, loadPluginModule, createPluginContext } = await import(
      "@/lib/plugin-loader"
    );
    const active = await getActivePlugins();
    const activeSet = new Set(active);
    // 清理已停用的插件
    for (const name of registeredPlugins) {
      if (!activeSet.has(name)) {
        registeredPlugins.delete(name);
        removeHooksByTag(`plugin:${name}`);
      }
    }
    for (const name of active) {
      if (registeredPlugins.has(name)) continue;
      registeredPlugins.add(name);
      const mod = await loadPluginModule(name);
      if (typeof mod?.registerHooks === "function") {
        try {
          await (mod.registerHooks as (ctx: unknown) => unknown)(createPluginContext(name));
        } catch (err) {
          console.error(`[hooks] 插件 ${name} 钩子注册失败：`, err);
        }
      }
    }
  } catch (err) {
    console.error("[hooks] ensurePluginHooks 失败：", err);
  }
}

/** 广播：依次执行所有钩子（不关心返回值）；单个钩子异常隔离，不影响主流程 */
export async function doAction(name: string, ...args: unknown[]): Promise<void> {
  await ensurePluginHooks();
  const list = registry.get(name);
  if (!list) return;
  for (const { fn } of list) {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`[hooks] 钩子 ${name} 执行失败：`, err);
    }
  }
}

/** 管道：value 依次经过每个钩子转换，返回最终值；异常时跳过该钩子 */
export async function applyFilters(
  name: string,
  value: unknown,
  ...args: unknown[]
): Promise<unknown> {
  await ensurePluginHooks();
  const list = registry.get(name);
  if (!list) return value;
  let current = value;
  for (const { fn } of list) {
    try {
      current = await fn(current, ...args);
    } catch (err) {
      console.error(`[hooks] 过滤器 ${name} 执行失败：`, err);
    }
  }
  return current;
}

// ---------- 事件载荷构造（BigInt 转字符串，插件友好） ----------
export function postPayload(p: {
  id: bigint | string | number;
  title?: string;
  slug?: string;
  status?: string;
  publishedAt?: Date | null;
  categoryId?: bigint | null;
  externalUrl?: string | null;
  isPinned?: boolean;
  categoryPinned?: boolean;
}) {
  return {
    id: String(p.id),
    title: p.title ?? "",
    slug: p.slug ?? "",
    status: p.status ?? "",
    publishedAt: p.publishedAt ?? null,
    categoryId: p.categoryId != null ? String(p.categoryId) : null,
    externalUrl: p.externalUrl ?? null,
    isPinned: p.isPinned ?? false,
    categoryPinned: p.categoryPinned ?? false,
  };
}

/** 同步版广播（用于不便 await 的调用点） */
export function doActionSync(name: string, ...args: unknown[]): void {
  ensurePluginHooks().catch(() => {});
  const list = registry.get(name);
  if (!list) return;
  for (const { fn } of list) {
    try {
      const r = fn(...args);
      if (r && typeof (r as Promise<unknown>).catch === "function") {
        (r as Promise<unknown>).catch((err) =>
          console.error(`[hooks] 钩子 ${name} 异步失败：`, err)
        );
      }
    } catch (err) {
      console.error(`[hooks] 钩子 ${name} 执行失败：`, err);
    }
  }
}
