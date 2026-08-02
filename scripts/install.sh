#!/usr/bin/env bash
# pafish 博客 CMS —— 一键安装脚本（Linux / macOS，Docker 方式）
# 用法：bash scripts/install.sh
# 步骤：环境检查 → 启动 MySQL（已有容器则跳过，防数据丢失）→ 生成 .env → 安装依赖
#       → 建表（migrate deploy）→ 补建搜索索引 → 种子数据 → 生产构建
set -euo pipefail
cd "$(dirname "$0")/.."

say()  { printf '\033[1;34m[%s]\033[0m %s\n' "$1" "$2"; }
fail() { printf '\033[1;31m[错误]\033[0m %s\n' "$1"; exit 1; }

say "1/9" "检查环境（node / npm / docker）..."
command -v node >/dev/null 2>&1 || fail "未安装 Node.js 18+（https://nodejs.org）"
command -v npm  >/dev/null 2>&1 || fail "未安装 npm"
command -v docker >/dev/null 2>&1 || fail "未安装 Docker（https://docs.docker.com/get-docker/）"
echo "  node $(node -v) / npm $(npm -v) / $(docker --version)"

say "2/9" "检查已有 MySQL 容器..."
if docker inspect pafish-mysql >/dev/null 2>&1; then
  RUNNING=$(docker inspect -f "{{.State.Running}}" pafish-mysql 2>/dev/null || echo "false")
  if [ "$RUNNING" = "true" ]; then
    echo "  检测到容器 pafish-mysql 已在运行，跳过容器创建（不会影响现有数据）"
  else
    echo "  检测到容器 pafish-mysql 存在但未运行，尝试启动（不会重建容器）"
    docker start pafish-mysql >/dev/null
  fi
  # 旧版 docker run 创建的容器无数据卷；如需持久化请按 README「升级已有容器到持久化」迁移
else
  echo "  未发现 pafish-mysql，通过 docker compose 创建（数据持久化到命名卷）"
  docker compose up -d
fi

say "3/9" "等待 MySQL 就绪..."
tries=0
until docker exec pafish-mysql mysqladmin ping -h 127.0.0.1 -uroot -ppafish_root_2026 >/dev/null 2>&1; do
  tries=$((tries + 1))
  [ "$tries" -ge 60 ] && fail "MySQL 启动超时，请检查：docker logs pafish-mysql"
  sleep 2
done
echo "  MySQL 已就绪"

say "4/9" "生成 .env（已存在则跳过）..."
node scripts/ensure-env.mjs

say "5/9" "安装依赖（npm ci）..."
npm ci --no-audit --no-fund

say "6/9" "建表（prisma migrate deploy）..."
npx prisma migrate deploy

say "7/9" "补建文章搜索索引..."
npx tsx scripts/fix-ft-index.ts

say "8/9" "写入种子数据（管理员 admin / Admin@12345）..."
npx prisma db seed

say "9/9" "生产构建..."
mkdir -p logs
npm run build

cat <<'EOF'

✅ 安装完成！启动方式：
  开发预览：  npm run dev        → http://localhost:3000
  生产运行：  npm start          → http://localhost:3000
  常驻部署：  pm2 start ecosystem.config.cjs && pm2 save

  默认账号：admin / Admin@12345（请登录后台后立即修改密码）
  上线前必改：.env 中 SITE_URL（正式域名）与 AUTH_SECRET（保持随机值即可）
EOF
