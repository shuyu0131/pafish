# 宝塔面板部署指南（Linux）

适用：服务器使用**宝塔面板**（Nginx + MySQL + Node.js 项目管理器）部署 pafish v1.0.0+。

> 与 `docker-compose` 方式的区别：宝塔自带 MySQL 管理，**不需要 Docker**。本指南用宝塔安装的 MySQL（端口 3306）+ Node 进程 + Nginx 反向代理，数据与升级都由宝塔管理，更贴合宝塔使用习惯。

## 0. 前置准备

1. 宝塔面板已安装并登录
2. 软件商店安装：
   - **Nginx**（1.22+）
   - **MySQL**（5.7 或 8.0 均可，推荐 8.0）
   - **Node.js 项目管理器**（在软件商店安装后，点「设置 → 版本管理」安装 **Node 20.9+**，推荐 22 LTS——Next.js 16 要求 Node ≥ 20.9）
3. 域名已解析到服务器（如 `blog.example.com`），并已在宝塔「网站」中创建站点

## 1. 创建数据库

宝塔 → **数据库** → **添加数据库**：

- 数据库名：`pafish`
- 用户名：`pafish`（可自定义）
- 密码：自己设置一个强密码（记下来，下一步要用）
- 编码：`utf8mb4`
- **访问权限：选「任意」（%）**——⚠️ 关键：选「本地（localhost）」会导致应用通过 `127.0.0.1` 连接时被 MySQL 拒绝

> 如果已创建且权限是 localhost，可在宝塔「数据库 → 管理（phpMyAdmin）」执行：
> ```sql
> CREATE USER IF NOT EXISTS 'pafish'@'127.0.0.1' IDENTIFIED BY '你的密码';
> GRANT ALL PRIVILEGES ON pafish.* TO 'pafish'@'127.0.0.1';
> FLUSH PRIVILEGES;
> ```

## 2. 上传源码

推荐 `git clone`（宝塔 → 终端，后续升级一条 `git pull` 即可）：

```bash
cd /www/wwwroot
git clone https://github.com/shuyu0131/pafish.git
```

或在本机把项目打包（**排除** `node_modules/`、`.env`、`.next/`、`public/uploads/`），用宝塔「文件」上传后解压到 `/www/wwwroot/pafish`。

## 3. 配置 .env

```bash
cd /www/wwwroot/pafish
cp .env.example .env
vi .env    # 或宝塔文件编辑器
```

修改为：

```
# 宝塔 MySQL（端口是 3306，不是 Docker 方式的 3307）
DATABASE_URL="mysql://pafish:你的数据库密码@127.0.0.1:3306/pafish"

# 随机 64 位密钥：在宝塔终端执行 node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_SECRET="生成的随机值"

# 正式域名（sitemap/RSS/OG 链接基准，务必 https 全称）
SITE_URL="https://blog.example.com"
```

> 若数据库用户权限有问题，可临时用 root 连接串调试（宝塔「数据库 → root 密码」可查看）：`mysql://root:宝塔root密码@127.0.0.1:3306/pafish`，确认无误后换回专用用户。

## 4. 安装依赖与初始化数据库

在宝塔终端执行（全程在项目目录）：

```bash
cd /www/wwwroot/pafish
npm ci --no-audit --no-fund
npx prisma migrate deploy     # 建表（17 个迁移）
npx tsx scripts/fix-ft-index.ts   # 补建中文全文搜索索引（必须执行）
npx prisma db seed            # 种子数据：admin / Admin@12345、示例文章、默认设置
mkdir -p logs
npm run build                 # 生产构建（约 1-3 分钟）
```

构建完成后立即验证一次启动：

```bash
npm start
# 另开终端：curl -I http://127.0.0.1:3000 应返回 200
```

确认正常后 `Ctrl+C` 停掉，进入下一步常驻运行。

## 5. 常驻运行（Node.js 项目管理器）

宝塔 → 软件商店 → **Node.js 项目管理器** → **添加 Node 项目**：

- 项目目录：`/www/wwwroot/pafish`
- 启动选项：**命令** 填 `npm run start`（或项目选择 `ecosystem.config.cjs` 用 PM2 方式）
- 运行用户：`www`
- 日志目录：默认即可（项目内 `logs/` 也可用）

> 定时发布调度器已内嵌在应用启动钩子中，**无需**在宝塔添加计划任务。
>
> 备用方案（终端直接 PM2）：
> ```bash
> npm i -g pm2
> pm2 start ecosystem.config.cjs && pm2 save
> pm2 startup    # 按提示执行输出的命令，实现开机自启
> ```

## 6. Nginx 反向代理

宝塔 → 网站 → 站点设置 → **反向代理** → 添加：

- 代理名称：`pafish`
- 目标 URL：`http://127.0.0.1:3000`
- 发送域名：`$host`（宝塔默认）
- 启用「缓存」可不勾选

如需手动配置（站点设置 → 配置文件，在 `server { }` 内）：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}

# 上传大文件（默认限制 20MB，如需更大则同步调高，且后台「上传大小限制」也要改）
client_max_body_size 50m;
```

最后：站点设置 → **SSL** → 一键申请 Let's Encrypt 证书并开启强制 HTTPS。

## 7. 收尾验证

1. 浏览器访问 `https://blog.example.com` → 前台正常
2. 访问 `/admin` → 用 `admin / Admin@12345` 登录 → **立即在「账号设置」修改默认密码**
3. 后台「站点设置」：
   - 站点地址已由 `SITE_URL` 决定，确认 sitemap/RSS 输出为正式域名
   - 按需配置「邮件服务 (SMTP)」（验证码/评论通知用）
   - 需要云存储时，到「应用商店」安装**缤纷云存储**插件（默认内置官方源，也可先测试本地源）

## 8. 日常运维

**备份**（宝塔 → 计划任务）：

- 数据库：备份 `pafish`（宝塔自动按库备份）
- 网站目录：备份 `/www/wwwroot/pafish`，**排除** `node_modules/`、`.next/`、`public/uploads/`、`logs/`（媒体文件大；若启用了云存储插件，媒体本体在云端，本地更轻）

**升级**（版本发布后，宝塔终端）：

```bash
cd /www/wwwroot/pafish
git pull
npm ci --no-audit --no-fund
npx prisma migrate deploy     # 应用新迁移
npx tsx scripts/fix-ft-index.ts   # 迁移后索引可能被 Prisma 重建逻辑影响，补一次无害
npm run build
pm2 restart pafish            # 或 Node 项目管理器里重启
```

**安全**：

- 3000 端口**不要**在宝塔安全/服务器安全组放行（只允许 Nginx 通过 127.0.0.1 访问）
- `.env` 含数据库密码，确保文件权限 `chmod 600 .env`，不要放进备份的排除名单之外

## 常见问题

| 现象 | 原因与解决 |
|------|-----------|
| 初始化时 `Access denied for user 'pafish'@'127.0.0.1'` | 数据库用户 host 不含 `127.0.0.1`，按第 1 节补 GRANT，或改用 root 连接串 |
| 前台搜索无结果 | FULLTEXT 索引缺失，重跑 `npx tsx scripts/fix-ft-index.ts` |
| 上传大文件返回 413 | nginx `client_max_body_size` 未调大（见第 6 节） |
| 构建报内存不足 | 加 swap（宝塔→终端：`fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`）或 `NODE_OPTIONS=--max-old-space-size=2048 npm run build` |
| 上传图片 500 / 无法写文件 | `public/uploads/` 属主不是运行用户，`chown -R www:www /www/wwwroot/pafish` |
| 改了 `.env` 不生效 | 重启 Node 进程（PM2 restart / Node 项目管理器重启） |
