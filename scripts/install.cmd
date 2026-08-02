@echo off
rem pafish 博客 CMS —— 一键安装脚本（Windows，Docker 方式）
rem 用法：双击运行，或 cmd 中执行 scripts\install.cmd
rem 步骤：环境检查 → 启动 MySQL（已有容器则跳过，防数据丢失）→ 生成 .env → 安装依赖
rem       → 建表（migrate deploy）→ 补建搜索索引 → 种子数据 → 生产构建
setlocal enabledelayedexpansion
cd /d "%~dp0.."

echo [1/9] 检查环境（node / npm / docker）...
where node >nul 2>nul || (echo [错误] 未安装 Node.js 18+，请访问 https://nodejs.org & exit /b 1)
where npm  >nul 2>nul || (echo [错误] 未安装 npm & exit /b 1)
where docker >nul 2>nul || (echo [错误] 未安装 Docker，请访问 https://www.docker.com/products/docker-desktop/ & exit /b 1)
for /f "delims=" %%v in ('node -v') do set NODE_VER=%%v
for /f "delims=" %%v in ('npm -v') do set NPM_VER=%%v
echo   node %NODE_VER% / npm %NPM_VER%
docker --version

echo [2/9] 检查已有 MySQL 容器...
docker inspect pafish-mysql >nul 2>nul
if %errorlevel%==0 (
  for /f "delims=" %%s in ('docker inspect -f "{{.State.Running}}" pafish-mysql 2^>nul') do set RUNNING=%%s
  if /i "!RUNNING!"=="true" (
    echo   检测到容器 pafish-mysql 已在运行，跳过容器创建（不会影响现有数据）
  ) else (
    echo   检测到容器 pafish-mysql 存在但未运行，尝试启动（不会重建容器）
    docker start pafish-mysql >nul
  )
  rem 旧版 docker run 创建的容器无数据卷；如需持久化请按 README「升级已有容器到持久化」迁移
) else (
  echo   未发现 pafish-mysql，通过 docker compose 创建（数据持久化到命名卷）
  docker compose up -d
  if errorlevel 1 (echo [错误] docker compose 启动失败，请确认 Docker Desktop 已运行 & exit /b 1)
)

echo [3/9] 等待 MySQL 就绪...
set /a TRIES=0
:wait_loop
docker exec pafish-mysql mysqladmin ping -h 127.0.0.1 -uroot -ppafish_root_2026 >nul 2>nul
if %errorlevel%==0 goto db_ready
set /a TRIES+=1
if %TRIES% geq 60 (echo [错误] MySQL 启动超时，请运行 docker logs pafish-mysql 查看 & exit /b 1)
timeout /t 2 /nobreak >nul
goto wait_loop
:db_ready
echo   MySQL 已就绪

echo [4/9] 生成 .env（已存在则跳过）...
node scripts\ensure-env.mjs
if errorlevel 1 exit /b 1

echo [5/9] 安装依赖（npm ci）...
call npm ci --no-audit --no-fund
if errorlevel 1 exit /b 1

echo [6/9] 建表（prisma migrate deploy）...
call npx prisma migrate deploy
if errorlevel 1 exit /b 1

echo [7/9] 补建文章搜索索引...
call npx tsx scripts\fix-ft-index.ts
if errorlevel 1 exit /b 1

echo [8/9] 写入种子数据（管理员 admin / Admin@12345）...
call npx prisma db seed
if errorlevel 1 exit /b 1

echo [9/9] 生产构建...
if not exist logs mkdir logs
call npm run build
if errorlevel 1 exit /b 1

echo.
echo [完成] 安装成功！启动方式：
echo   开发预览：  npm run dev        ^> http://localhost:3000
echo   生产运行：  npm start          ^> http://localhost:3000
echo   常驻部署：  pm2 start ecosystem.config.cjs ^&^& pm2 save
echo.
echo   默认账号：admin / Admin@12345（请登录后台后立即修改密码）
echo   上线前必改：.env 中 SITE_URL（正式域名）与 AUTH_SECRET（保持随机值即可）
endlocal
