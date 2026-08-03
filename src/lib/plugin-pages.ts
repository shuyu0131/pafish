import "server-only";
import { prisma } from "@/lib/db";
import {
  createPluginContext,
  getActivePlugins,
  loadPluginModule,
} from "@/lib/plugin-loader";

// ---------- 插件页面模板渲染管线 ----------
// 与注入管线（lib/plugin-injections.ts）同模式：前台 RSC 无法动态加载插件代码，
// 由 node runtime 遍历激活插件调用 index.mjs 的 renderPageTemplate(template, page, ctx)，
// 产出 HTML 写入 settings（page_template:{slug}），前台 RSC 读值输出。
// 刷新时机：页面保存/删除、插件启停、服务器启动预热（bootstrapPlugins）。

export const PAGE_TEMPLATE_KEY = (slug: string) => `page_template:${slug}`;

/** 对一个页面执行插件模板渲染：按优先级顺序尝试激活插件，返回首个非空 HTML（无则空串） */
export async function renderPageTemplateHtml(page: {
  slug: string;
  title: string;
  content: string;
  template: string;
}): Promise<string> {
  const active = await getActivePlugins();
  for (const name of active) {
    const mod = await loadPluginModule(name);
    const fn = mod?.renderPageTemplate;
    if (typeof fn !== "function") continue;
    try {
      const html = await (fn as (template: string, page: unknown, ctx: unknown) => unknown)(
        page.template,
        { slug: page.slug, title: page.title, content: page.content },
        createPluginContext(name)
      );
      if (typeof html === "string" && html.trim()) return html.trim();
    } catch (err) {
      console.error(`[plugins] ${name} renderPageTemplate(${page.template}) 失败：`, err);
    }
  }
  return "";
}

/** 全量重渲染全部已发布页面的模板缓存（渲染不到则写空串，插件卸载残留自然清除） */
export async function refreshPluginPages(): Promise<void> {
  let pages: { slug: string; title: string; content: string; template: string }[];
  try {
    pages = await prisma.page.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, title: true, content: true, template: true },
    });
  } catch {
    return;
  }
  const entries = await Promise.all(
    pages.map(async (p) => ({
      key: PAGE_TEMPLATE_KEY(p.slug),
      html: await renderPageTemplateHtml(p),
    }))
  );
  await prisma.$transaction(
    entries.map(({ key, html }) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: html },
        create: { key, value: html },
      })
    )
  );
}

/** 前台 RSC 读取页面的插件模板 HTML（无则空串，走默认 Markdown 渲染） */
export async function getPageTemplateHtml(slug: string): Promise<string> {
  try {
    const row = await prisma.setting.findFirst({ where: { key: PAGE_TEMPLATE_KEY(slug) } });
    return row?.value ?? "";
  } catch {
    return "";
  }
}
