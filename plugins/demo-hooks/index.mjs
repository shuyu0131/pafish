// 演示插件：事件钩子
// 通过 ctx.on() 注册系统事件钩子（对应 lib/hooks.ts 的 doAction 点位），
// ctx.log() 将日志写入插件数据（settings plugin_data:demo-hooks）。

export function registerHooks(ctx) {
  ctx.on("after_create_post", (post) => ctx.log(`文章发布：${post.title}（id=${post.id}）`));
  ctx.on("after_update_post", (post) => ctx.log(`文章更新：${post.title}（id=${post.id}）`));
  ctx.on("after_comment_submit", (c) =>
    ctx.log(`收到评论：${c.author} 于文章 ${c.postId}（${c.status}）`)
  );
  ctx.on("after_comment_status", (c) => ctx.log(`评论 ${c.id} 状态：${c.from} → ${c.to}`));
  ctx.on("after_login", (u) => ctx.log(`用户登录：${u.username}`));
  ctx.on("after_logout", (u) => ctx.log(`用户登出：id=${u.id}`));
}

export function onActivate() {
  console.log("[demo-hooks] 已激活");
}

export function onDeactivate() {
  console.log("[demo-hooks] 已停用");
}
