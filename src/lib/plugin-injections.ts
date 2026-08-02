import "server-only";
import { prisma } from "@/lib/db";
import {
  INJECT_TARGETS,
  InjectTarget,
  createPluginContext,
  getActivePlugins,
  loadPluginModule,
} from "@/lib/plugin-loader";

// ---------- 注入管线 ----------
// 前台（RSC）无法动态加载插件代码，因此采用"渲染缓存"模式：
// node runtime 遍历激活插件，调用 renderInjection(target) 产出 HTML 片段，
// 拼接后写入 settings（plugin_inject_head/footer/sidebar），RSC 读值输出。

export const INJECT_KEYS: Record<InjectTarget, string> = {
  head: "plugin_inject_head",
  footer: "plugin_inject_footer",
  sidebar: "plugin_inject_sidebar",
};

/** 在 node runtime 执行：重新渲染全部激活插件的注入内容并写库 */
export async function refreshInjections(): Promise<void> {
  const active = await getActivePlugins();
  const out: Record<InjectTarget, string> = { head: "", footer: "", sidebar: "" };
  for (const name of active) {
    const mod = await loadPluginModule(name);
    const fn = mod?.renderInjection;
    if (typeof fn !== "function") continue;
    for (const target of INJECT_TARGETS) {
      try {
        const html = await (fn as (t: InjectTarget, ctx: unknown) => unknown)(
          target,
          createPluginContext(name)
        );
        if (typeof html === "string" && html.trim()) {
          out[target] += html.trim() + "\n";
        }
      } catch (err) {
        console.error(`[plugins] ${name} renderInjection(${target}) 失败：`, err);
      }
    }
  }
  await prisma.$transaction(
    INJECT_TARGETS.map((t) =>
      prisma.setting.upsert({
        where: { key: INJECT_KEYS[t] },
        update: { value: out[t] },
        create: { key: INJECT_KEYS[t], value: out[t] },
      })
    )
  );
}

/** 前台 RSC 读取注入内容（直接查库，避开 React cache 跨请求缓存） */
export async function getInjection(target: InjectTarget): Promise<string> {
  try {
    const row = await prisma.setting.findFirst({ where: { key: INJECT_KEYS[target] } });
    return row?.value ?? "";
  } catch {
    return "";
  }
}

// ---------- head 注入解析 ----------
// head 只允许合法元素（script/meta/link/style），把 HTML 字符串拆分为 React 元素可渲染的结构

export interface HeadScriptTag {
  src?: string;
  inline: string;
}
export interface HeadTag {
  attrs: string; // meta / link 的属性字符串
}
export interface HeadStyleTag {
  attrs: string;
  css: string;
}
export interface ParsedHead {
  scripts: HeadScriptTag[];
  metas: HeadTag[];
  links: HeadTag[];
  styles: HeadStyleTag[];
}

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
const META_RE = /<meta\b[^>]*>/g;
const LINK_RE = /<link\b[^>]*>/g;
const STYLE_RE = /<style\b([^>]*)>([\s\S]*?)<\/style>/g;

export function parseInjectionTags(html: string): ParsedHead {
  const scripts: HeadScriptTag[] = [];
  const metas: HeadTag[] = [];
  const links: HeadTag[] = [];
  const styles: HeadStyleTag[] = [];
  let rest = html;

  // 顺序提取后从原文移除，剩余未识别部分忽略（保证 meta/link 不被 script 内容误伤）
  const take = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    const found: string[] = [];
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(html)) !== null) {
      found.push(m[0]);
      fn(m);
    }
    for (const f of found) rest = rest.replace(f, "");
    return found.length;
  };

  take(SCRIPT_RE, (m) => {
    const attrs = m[1] ?? "";
    const srcMatch = /src\s*=\s*["']([^"']+)["']/.exec(attrs);
    scripts.push({ src: srcMatch?.[1], inline: m[2] ?? "" });
  });
  take(STYLE_RE, (m) => styles.push({ attrs: m[1] ?? "", css: m[2] ?? "" }));
  take(META_RE, (m) => {
    const attrs = m[0].replace(/^<meta\b/i, "").replace(/\/?>$/, "").trim();
    if (attrs) metas.push({ attrs });
  });
  take(LINK_RE, (m) => {
    const attrs = m[0].replace(/^<link\b/i, "").replace(/\/?>$/, "").trim();
    if (attrs) links.push({ attrs });
  });

  return { scripts, metas, links, styles };
}
