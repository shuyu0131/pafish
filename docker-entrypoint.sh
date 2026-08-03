#!/bin/sh
# pafish 容器入口：首启初始化 → 迁移 → 索引 → 种子 → 启动服务
set -e
cd /app

# 首次启动：命名卷为空时恢复内置主题/插件（商店安装/主题管理写入 themes/、plugins/，挂卷后重启不丢）
if [ -z "$(ls -A /app/themes 2>/dev/null)" ]; then
  echo "[pafish] 初始化内置主题..."
  cp -a /app/themes-seed/. /app/themes/
fi
if [ -z "$(ls -A /app/plugins 2>/dev/null)" ]; then
  echo "[pafish] 初始化内置插件..."
  cp -a /app/plugins-seed/. /app/plugins/
fi

echo "[pafish] 数据库迁移（prisma migrate deploy）..."
node /app/node_modules/prisma/build/index.js migrate deploy

echo "[pafish] 补建全文搜索索引..."
node /app/fix-ft-index.cjs

echo "[pafish] 种子数据（upsert 幂等，不覆盖已有数据）..."
node /app/seed.cjs

echo "[pafish] 启动服务（http://0.0.0.0:3000）..."
exec node /app/server.js
