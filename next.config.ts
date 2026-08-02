import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
