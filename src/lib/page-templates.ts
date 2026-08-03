import { getActiveThemePageTemplates } from "@/lib/theme";
import { getActivePlugins, readManifest } from "@/lib/plugin-loader";

// ---------- 页面模板选项（后台编辑器下拉 + 前台分发属性） ----------
// 模板来源三层（对标 emlog page_*.php 自定义模板）：
// - system：默认 Markdown 渲染（保留名 "default"，不可被主题/插件占用）
// - theme：主题在 theme.json 声明 pageTemplates，纯 CSS 分发（前台容器 data-page-template + 类名）
// - plugin：插件在 plugin.json 声明 pageTemplates，HTML 渲染（index.mjs renderPageTemplate，node runtime 缓存）

export interface PageTemplateOption {
  name: string;
  title: string;
  source: "system" | "theme" | "plugin";
  plugin?: string; // source=plugin 时的来源插件名
  description?: string;
}

/** 后台页面编辑器可选的模板列表：默认 + 激活主题声明 + 激活插件声明 */
export async function getPageTemplateOptions(): Promise<PageTemplateOption[]> {
  const options: PageTemplateOption[] = [
    { name: "default", title: "默认", source: "system" },
  ];
  for (const t of await getActiveThemePageTemplates()) {
    options.push({
      name: t.name,
      title: t.title,
      source: "theme",
      description: t.description,
    });
  }
  const active = await getActivePlugins();
  for (const name of active) {
    const { manifest } = readManifest(name);
    for (const t of manifest?.pageTemplates ?? []) {
      options.push({ name: t.name, title: t.title, source: "plugin", plugin: name });
    }
  }
  return options;
}

/** 前台页面容器模板属性（非 default 模板时输出 data-page-template 与 page-template-{name} 类，主题 CSS 据此定义布局差异） */
export function pageTemplateProps(template: string) {
  const t = template && template !== "default" ? template : null;
  return t
    ? { "data-page-template": t, className: `page-template-${t}` }
    : { "data-page-template": undefined as string | undefined, className: undefined as string | undefined };
}
