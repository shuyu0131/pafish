# pafish 完全容器化部署（Docker 安装教程）

把 MySQL **和博客应用**都跑在 Docker 容器里：一条命令启动全部，首次启动自动完成建表、索引、种子数据。适合**交付部署**、**多台机器批量部署**，或不想在机器上安装 Node.js 的场景。

## 一、前置要求

| 项 | 要求 |
|----|------|
| Docker | 20.10+（Windows 装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)，需保持运行） |
| 磁盘 | 镜像约 1.5GB，另留数据卷空间 |
| 网络 | 构建镜像需能访问 npm registry（国内可配置 registry 镜像，见"常见问题"） |

**不需要**安装 Node.js / npm / MySQL——全部在容器内。

## 二、安装步骤

### 1. 获取代码

```bash
git clone https://github.com/shuyu0131/pafish.git
cd pafish
```

### 2. 配置 `.env`

```bash
cp .env.example .env
```

至少修改两处（用任意编辑器打开 `.env`）：

- `AUTH_SECRET`——保持随机值即可（若为空可运行 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 生成）
- `SITE_URL`——改为正式域名，如 `https://blog.example.com`（sitemap/RSS/OG 链接基准）

> `DATABASE_URL` **不需要改**——容器内自动指向 compose 网络的 MySQL 服务。
> 可选：SMTP 五键（`SMTP_HOST` 等）为邮件验证码/评论通知的兜底配置，也可部署后在后台「站点设置 → 邮件服务」配置。

### 3. 构建并启动

```bash
docker compose up -d --build
```

首次构建约 3~10 分钟（下载基础镜像 + 安装依赖 + 编译）。启动后：

```bash
docker compose ps          # 两个服务都 healthy 即成功
docker compose logs -f app # 跟踪应用日志（迁移/索引/种子完成会打印，然后进入启动日志）
```

### 4. 访问

- 前台：http://localhost:3000 （默认端口可改，见"端口冲突"）
- 后台：http://localhost:3000/admin
- 默认账号：**admin / Admin@12345**（请登录后台后立即修改密码）

## 三、首次启动自动完成了什么

容器入口脚本（`docker-entrypoint.sh`）按顺序执行，全部幂等：

1. **空卷恢复内置主题/插件**（`themes/`、`plugins/` 挂载的是命名卷，首次为空时从镜像内种子恢复）
2. **数据库迁移**：`prisma migrate deploy`（应用全部迁移）
3. **补建全文索引**：`fix-ft-index`（FULLTEXT ngram，中文搜索依赖）
4. **种子数据**：`seed`（upsert 幂等——已存在的数据不会被覆盖，仅首次创建管理员/编辑、示例文章、默认设置）
5. 启动服务

之后每次 `docker compose restart` 会重跑迁移/种子（数秒，幂等安全），日常重启无需担心。

## 四、常用命令

```bash
docker compose up -d --build     # 构建并启动
docker compose ps                # 查看状态
docker compose logs -f app       # 应用日志
docker compose logs mysql        # 数据库日志
docker compose restart app       # 重启应用
docker compose down              # 停止（数据卷保留）
docker compose down -v           # 停止并删除数据卷（⚠️ 全部数据清空，慎用）
```

## 五、升级版本

```bash
git pull                 # 拉取新代码
docker compose up -d --build   # 重新构建镜像并滚动重启（自动跑迁移）
```

升级前建议先备份（见下）。

## 六、备份与恢复

### 数据都在命名卷里

| 卷 | 内容 | 说明 |
|----|------|------|
| `pafish-mysql-data` | MySQL 数据 | 最重要的数据 |
| `pafish-uploads` | 上传媒体 | 本地回退文件（启用云存储插件后主要存云端） |
| `pafish-themes` | 主题 | 商店安装的主题 |
| `pafish-plugins` | 插件 | 商店安装的插件 |
| `pafish-backups` | 备份文件 | 后台「数据备份」生成 |

### 数据库备份（推荐定期执行）

```bash
# 导出（Linux/macOS）
docker compose exec mysql sh -c 'mysqldump -uroot -ppafish_root_2026 --databases pafish' > pafish-backup.sql

# Windows PowerShell
docker compose exec mysql sh -c "mysqldump -uroot -ppafish_root_2026 --databases pafish" > pafish-backup.sql
```

### 数据库恢复

```bash
docker compose exec -T mysql sh -c 'mysql -uroot -ppafish_root_2026' < pafish-backup.sql
```

### 后台「数据备份/恢复」

后台设置页的备份/恢复功能在容器内同样可用——已自动配置好 `DB_HOST=mysql` 连接地址，备份文件写入 `pafish-backups` 卷（重启不丢）。恢复需在应用停止时执行。

## 七、配置说明

| 环境变量 | 默认 | 说明 |
|----------|------|------|
| `MYSQL_PORT` | 3307 | MySQL 宿主机映射端口（冲突时改） |
| `APP_PORT` | 3000 | 应用宿主机端口（改后访问 http://localhost:改后的端口） |
| `AUTH_SECRET` | 示例值 | 会话签名密钥，**生产必须配置** |
| `SITE_URL` | localhost | 站点绝对 URL，**生产必须配置** |
| `SMTP_*` | 空 | 邮件兜底配置（后台可配，env 仅兜底） |
| `DB_*` | compose 内网 | 备份功能连接地址，**无需修改** |

修改 `.env` 后需 `docker compose up -d`（重建容器）生效。

## 八、与「混合模式」（一键脚本）的关系

两种部署方式并存、互不冲突：

- **完全容器化（本文档）**：应用也进容器，`docker compose up -d` 一条命令；推荐交付/多机部署
- **混合模式**（`bash scripts/install.sh` 或 `install.cmd`）：MySQL 用容器、应用跑在宿主 Node 上（PM2 常驻）；推荐单台服务器自托管，开发调试更直接

两者都使用 `docker-compose.yml` 的 `mysql` 服务（`install.sh` 只启动数据库服务）。注意：**旧版 `docker run` 的 `pafish-mysql` 容器（无数据卷）与两者不冲突**，但如长期使用建议按 README「升级已有容器到持久化」迁移。

## 九、常见问题

**Q：`docker compose up` 报端口 3307/3000 被占用？**
改端口：`MYSQL_PORT=3308 APP_PORT=3001 docker compose up -d --build`（服务间用 compose 内网通信，端口映射只影响宿主访问）。

**Q：构建时 npm 下载慢/失败（国内网络）？**
在 `.env` 中加一行 `NPM_REGISTRY=https://registry.npmmirror.com`（compose 构建时自动透传 npm registry），然后重新 `docker compose up -d --build`。直接 docker build 也可：
```bash
docker build -t pafish --build-arg npm_config_registry=https://registry.npmmirror.com .
```

**Q：想用云存储插件（缤纷云）？**
后台 → 应用商店 → 安装「缤纷云存储」（内置源直连官方商店），设置 AccessKey/SecretKey 后媒体自动存云端；容器内 `public/uploads` 卷仅存本地回退文件。

**Q：应用起不来，日志报数据库连接失败？**
检查 MySQL 健康状态：`docker compose ps`；首次启动 `depends_on: service_healthy` 会等 MySQL 就绪才启动应用，耐心等 1~2 分钟即可。

**Q：多实例部署（横向扩容）？**
定时发布 cron 内嵌在应用进程（单实例即可）；多副本会导致定时任务重复执行（有查询层兜底，不会提前泄露文章）。如需多副本，请将定时发布调度器独立进程化（见 `src/instrumentation.ts`）。

**Q：容器内时区？**
MySQL 与应用容器均已设置 `TZ=Asia/Shanghai`（compose 中配置）。
