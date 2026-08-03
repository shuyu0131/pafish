import "server-only";
import { getSettings } from "@/lib/settings";
import { getVisibleNavItems } from "@/lib/widgets";
import { getActiveTheme, getThemeCss } from "@/lib/theme";
import { getInjection, parseInjectionTags } from "@/lib/plugin-injections";

// ---------- 插件前台页面 HTML Shell ----------
// 插件前台页面（/plugin/<name>/<path>）走 route handler（node runtime）渲染完整 HTML，
// 绕开 RSC 无法动态加载插件代码的限制（与注入管线同理）。
// shell 复刻前台布局骨架：站点名/导航/主题变量/head+footer 注入。

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 基础样式：语义变量兜底（与 globals.css 一致）+ 简单布局骨架
const SHELL_CSS = `
:root{--bg:#ffffff;--fg:#464646;--muted:#8f8f8f;--card:#ffffff;--border:#f2f2f2;--accent:#4786d6;--accent-soft:rgba(71,134,214,.08);--danger:#b4543f;--title:#5f5f5f;--meta:#bbbbbb;--side:#565654}
.dark{--bg:#161616;--fg:#d6d6d6;--muted:#8a8a8a;--card:#1c1c1c;--border:#333333;--accent:#6fa3e8;--accent-soft:rgba(111,163,232,.12);--danger:#d47a63;--title:#c9c9c9;--meta:#7d7d7d;--side:#a8a8a8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;line-height:1.7}
a{color:var(--accent);text-decoration:none}
.shell-nav{display:flex;align-items:center;gap:20px;height:60px;padding:0 32px;border-bottom:1px solid var(--border);background:var(--card);position:sticky;top:0;z-index:10}
.shell-nav .site-name{font-weight:700;letter-spacing:2px;color:var(--fg);text-transform:uppercase;font-size:14px;margin-right:auto}
.shell-nav a:not(.site-name){font-size:13px;color:var(--side)}
.shell-nav a:not(.site-name):hover{color:var(--accent)}
.shell-body{max-width:760px;margin:0 auto;padding:40px 32px 64px}
.shell-footer{border-top:1px solid var(--border);text-align:center;padding:24px;font-size:10px;color:var(--meta)}
`;

/** 渲染插件前台页面完整 HTML（含站点骨架与注入） */
export async function renderPublicShell(bodyHtml: string, title: string): Promise<string> {
  const settings = await getSettings();
  const siteName = settings.site_name || "纸鱼博客";
  const subtitle = settings.site_subtitle || "";
  const theme = await getActiveTheme();
  const themeCss = getThemeCss(theme);
  const headInjection = await getInjection("head");
  const footerInjection = await getInjection("footer");

  // head 注入：只输出合法元素（与前台 parseInjectionTags 一致）
  const parsed = parseInjectionTags(headInjection);
  const headTags = [
    ...parsed.metas.map((m) => `<meta ${m.attrs}>`),
    ...parsed.links.map((l) => `<link ${l.attrs}>`),
    ...parsed.styles.map((s) => `<style ${s.attrs}>${s.css}</style>`),
    ...parsed.scripts.map((s) =>
      s.src ? `<script src="${s.src}"></script>` : `<script>${s.inline}</script>`
    ),
  ].join("\n");

  const navItems = await getVisibleNavItems();
  const navHtml = navItems
    .map(
      (n) =>
        `<a href="${esc(n.url)}"${n.isExternal ? ' target="_blank" rel="noopener"' : ""}>${esc(n.label)}</a>`
    )
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(siteName)}</title>
${subtitle ? `<meta name="description" content="${esc(subtitle)}">` : ""}
<style>${SHELL_CSS}</style>
${themeCss ? `<style data-theme="${esc(theme)}">${themeCss}</style>` : ""}
${headTags}
</head>
<body>
<nav class="shell-nav">
  <a class="site-name" href="/">${esc(siteName)}</a>
  ${navHtml}
</nav>
<main class="shell-body">
${bodyHtml}
</main>
<footer class="shell-footer">
  <p>${esc(settings.site_icp ?? "")}</p>
  ${footerInjection}
</footer>
</body>
</html>`;
}
