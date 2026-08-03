// pafish 开发文档配套示例插件（原生 ESM）
// 三个导出全部可选：
//   registerHooks(ctx)       —— 注册事件钩子（node runtime 触发）
//   onActivate/onDeactivate/onUninstall(ctx) —— 生命周期回调
//   renderInjection(target, ctx) —— 前台注入（head/footer/sidebar，返回 HTML 字符串）

export function registerHooks(ctx) {
  // priority 越小越先执行，默认 10；钩子带来源标记 plugin:demo-plugin，停用自动注销
  ctx.on("after_create_post", (post) => {
    ctx.log(`文章发布：${post.title}（id=${post.id}）`);
  });
  ctx.on("after_comment_submit", (c) => {
    ctx.log(`收到评论：${c.author} @ 文章 ${c.postId}（${c.status}）`);
  });
}

export async function onActivate(ctx) {
  await ctx.log("demo-plugin 已启用");
  // 首次启用即渲染前台注入缓存
  await ctx.refreshInjections();
}

export async function onDeactivate(ctx) {
  await ctx.log("demo-plugin 已停用");
}

// 前台注入：返回 HTML 字符串，按 manifest.injects 声明的点位输出；
// 设置变更后调用 ctx.refreshInjections() 重新渲染
export async function renderInjection(target, ctx) {
  if (target !== "footer") return "";
  const s = await ctx.getSettings();
  if (s.show_footer === "0") return "";
  const text = s.greeting || "来自 demo-plugin 的问候";
  if (s.footer_style === "card") {
    return `<div class="card mx-auto mb-4 max-w-2xl p-4 text-sm">💬 ${text}</div>`;
  }
  return `<p class="text-sm">💬 ${text}</p>`;
}
