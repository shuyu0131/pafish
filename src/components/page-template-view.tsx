import { MarkdownRender } from "@/components/markdown-render";
import { getPageTemplateHtml } from "@/lib/plugin-pages";

// 页面模板分发（对标 emlog page_*.php 自定义模板）：
// 插件渲染的 HTML（node runtime 写入缓存）优先输出，完全接管页面内容；
// 否则默认 Markdown 渲染（主题层模板差异由外层容器的 data-page-template 驱动，见 pageTemplateProps）。

export default async function PageTemplateView({
  page,
}: {
  page: { slug: string; title: string; content: string; template: string };
}) {
  const pluginHtml = await getPageTemplateHtml(page.slug);
  if (pluginHtml) {
    return <div className="plugin-page" dangerouslySetInnerHTML={{ __html: pluginHtml }} />;
  }
  return <MarkdownRender content={page.content} />;
}
