// Next.js 服务启动钩子：注册定时发布任务 + 插件系统预热
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = (await import("node-cron")).default;
    const { publishScheduledPosts } = await import("@/lib/scheduler");

    // 每分钟检查一次到期的定时文章
    cron.schedule("* * * * *", () => {
      publishScheduledPosts().catch((e) =>
        console.error("[定时发布] 执行失败:", e)
      );
    });
    console.log("[定时发布] 调度器已启动（每分钟检查）");

    // 插件系统预热：注册全部激活插件的事件钩子 + 刷新注入缓存
    // （进程重启后模块级注册表为空，必须重新注册）
    const { bootstrapPlugins } = await import("@/lib/plugin-loader");
    bootstrapPlugins()
      .then(() => console.log("[插件] 已预热：钩子注册与注入缓存刷新完成"))
      .catch((e) => console.error("[插件] 预热失败:", e));
  }
}
