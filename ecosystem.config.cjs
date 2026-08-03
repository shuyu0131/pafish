// PM2 生产部署配置（Linux 服务器）
// 使用：pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: "pafish",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "500M",
      // 定时发布调度器已内嵌在 Next.js 服务启动钩子（src/instrumentation.ts），无需额外进程
      // 如需反向代理：nginx 将 80/443 转发到 3000
      out_file: "logs/out.log",
      error_file: "logs/error.log",
      time: true,
    },
  ],
};
