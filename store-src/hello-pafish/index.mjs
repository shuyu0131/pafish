// 应用商店安装演示插件
// 通过 ctx.on() 注册事件钩子，ctx.log() 写入插件数据（插件列表“查看插件数据”可见）
// 能力演示：
//   - 页面模板：plugin.json 声明 pageTemplates，renderPageTemplate 渲染选中该模板的页面（创建页面时下拉可选）
//   - 插件前台页面：plugin.json 声明 pages，renderPluginPage 渲染 /plugin/<name>/<path>

export function registerHooks(ctx) {
  ctx.log("Hello, pafish! 我已通过应用商店安装并启用。");
  ctx.on("after_login", (u) => ctx.log(`商店插件：用户 ${u.username} 登录`));
}

// 页面模板渲染：只处理自己声明的模板名，其余返回 null（交给后续插件/默认渲染）
export function renderPageTemplate(template, page) {
  if (template !== "card") return null;
  return `<div style="border:1px solid var(--border);border-radius:12px;padding:24px 28px;background:var(--card)">
    <h2 style="margin-top:0">卡片模板：${escapeHtml(page.title)}</h2>
    <p style="color:var(--muted);font-size:13px">此页面由插件 hello-pafish 的 renderPageTemplate 渲染（HTML 缓存管线）。</p>
    <div>${escapeHtml(page.content)}</div>
  </div>`;
}

// 插件前台页面：渲染 /plugin/hello-pafish/hello（含 ctx API 访问示例）
export async function renderPluginPage(path, ctx) {
  if (path !== "hello") return null;
  const data = await ctx.getData();
  const logs = Array.isArray(data.logs) ? data.logs.slice(-5) : [];
  return `<h1>Hello, pafish!</h1>
  <p>这是插件前台页面（/plugin/hello-pafish/hello），由 hello-pafish 的 <code>renderPluginPage</code> 渲染，
  并套用站点的导航 / 主题 / 页脚注入。</p>
  <h3>最近插件日志</h3>
  <ul>${logs
    .map((l) => `<li>${new Date(l.t).toLocaleString()}：${escapeHtml(l.msg)}</li>`)
    .join("") || "<li>暂无日志</li>"}</ul>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function onActivate() {
  console.log("[hello-pafish] 已激活");
}

export function onDeactivate() {
  console.log("[hello-pafish] 已停用");
}
