import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 镜像（Dockerfile）使用 standalone 输出；本地 next start 不受影响
  output: "standalone",
  // Prisma 7 相关包不打进 Turbopack bundle（Windows junction 兼容问题 + 减少打包体积）
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-mariadb",
    "@prisma/driver-adapter-utils",
    "mariadb",
    "bcryptjs",
    "adm-zip",
  ],
};

export default nextConfig;
