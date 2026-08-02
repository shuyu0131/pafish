# 纸鱼博客 CMS

一个极简风格的独立博客系统（Next.js 全栈）。与 PHP 官网（pafish-web）完全独立，互不干扰；上线后只需在官网导航加一个链接即可互通。

## 技术栈

- **Next.js 16**（App Router + Server Actions；Windows 下 dev 用 webpack，见"已知说明"）
- **React 19 + TypeScript + Tailwind CSS v4**（Anatole 白色极简双栏主题，亮/暗模式）
- **Prisma 7**（driver adapter 直连 MySQL，`@prisma/adapter-mariadb`）
- **MySQL 8**（Docker 容器，FULLTEXT ngram 中文全文搜索索引）
- **自研 JWT 认证**（jose + httpOnly cookie，7 天有效期）
- **@uiw/react-md-editor**（后台 Markdown 编辑器，粘贴/拖拽传图）
- **remark + rehype-highlight**（前台文章渲染 + 代码高亮）
- **系统字体栈**（PingFang SC / Microsoft YaHei / Helvetica Neue，无 Google Fonts 依赖，国内直连可用）

## 功能

- 前台：文章列表（分页、**置顶优先**）、详情页（浏览量 7 天去重/上下篇/**相关推荐**）、分类、标签、中文全文搜索、关于页、亮暗主题切换、游客评论与**嵌套回复**（昵称+邮箱，审核后显示，**三道反垃圾防线**）、**评论点赞（cookie 防刷）**、**评论分页**、**被回复邮件通知（可选勾选）**
- 后台 `/admin`：工作台（**发文趋势/分类分布图表**、统计卡片）、**分组折叠侧边栏（内容/互动/外观/系统，展开状态本地记忆，移动端抽屉式）**、文章管理（草稿/发布/**定时发布**/**置顶**/**批量操作**/**多维筛选与排序**/**回收站防误删**）、Markdown 编辑器（封面/摘要/分类/标签、**Ctrl+S 快捷保存**、**批量导入 .md**、**emlog 式"插入媒体"：本地上传或媒体库选择，图片插为 Markdown 图片、其他文件插为下载链接，封面图也可从媒体库选取**）、**媒体库（图片/文档/压缩包/音视频多类型统一管理，页内直接上传、按类型筛选与搜索、添加外部资源链接（仅存 URL 不下载）、图片上传自动压缩，复制 URL/删除）**、分类与标签 CRUD、评论审核队列（通过/垃圾/删除，**标注回复上下文**）、**通知中心（新评论/新回复站内提醒 + 未读徽标，可配置邮件通知）**、站点设置（**含"上传大小限制"配置**）、用户角色管理
- **移动端自适应**：前台/后台均适配手机屏幕——文章列表表格窄屏可横向滚动，评论/组件等操作按钮多的卡片在移动端自动纵向堆叠不被挤压，编辑/媒体库弹窗全宽显示
- API：媒体上传（类型白名单：图片/文档/压缩包/音视频 + **大小限制可在站点设置调整，默认 20MB** + 图片 **sharp 自动压缩**）、评论提交（支持回复/点赞）、**浏览量去重上报**、node-cron 每分钟自动发布到期定时文章
- **插件系统**：后台「插件管理」启用/停用/卸载（目录即应用，零构建）；事件钩子、前台注入、页面模板、插件前台页面、**云存储后端**（如缤纷云 S4：媒体上传自动存云端并释放服务器磁盘，失败自动回退本地）；**应用商店**（内置源 + 远程私有源，在线安装/更新）

## 快速开始

### 1. 启动 MySQL（Docker）

```bash
docker run -d --name pafish-mysql \
  -p 3307:3306 \
  -e MYSQL_ROOT_PASSWORD=pafish_root_2026 \
  -e MYSQL_DATABASE=pafish \
  -e MYSQL_USER=pafish \
  -e MYSQL_PASSWORD=pafish_pass \
  -e TZ=Asia/Shanghai \
  mysql:8.0 --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`（或直接使用现有 `.env`）：

```
DATABASE_URL="mysql://pafish:pafish_pass@127.0.0.1:3307/pafish"
AUTH_SECRET="pafish-secret-2026-change-me"   # 生产环境务必更换
SITE_URL="http://localhost:3000"                     # 生产环境改为正式域名（sitemap/RSS/OG 用）
```

### 3. 安装依赖与初始化数据库

```bash
npm install
npx prisma migrate dev     # 建表（之后需手动重建 FULLTEXT 索引，见"运维注意"）
npx prisma db seed         # 种子数据（管理员/示例文章/默认设置）
```

> 若迁移需要 shadow database 权限，可用 root 连接串执行：`DATABASE_URL="mysql://root:pafish_root_2026@127.0.0.1:3307/pafish" npx prisma migrate dev`

### 4. 启动

```bash
npm run dev        # next dev --webpack（Windows 必需，Turbopack 有 junction bug）
```

访问 http://localhost:3000 ，后台 http://localhost:3000/admin

**默认账号**（请尽快修改）：

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | Admin@12345 |
| 编辑 | editor | Editor@12345 |

## 目录结构

```
src/
├── app/
│   ├── (public)/          # 前台：首页/详情/分类/标签/搜索/关于
│   ├── admin/             # 后台：工作台/文章/分类/标签/评论/设置/用户
│   ├── api/               # 上传、评论提交/点赞、Markdown 导入
│   ├── login/             # 登录页
│   ├── rss.xml/           # RSS 订阅源（route handler）
│   ├── robots.ts          # robots.txt（搜索引擎放行 + sitemap 指向）
│   ├── sitemap.ts         # sitemap.xml（文章/分类/标签动态生成）
│   ├── layout.tsx         # 根布局（metadata/OG/主题 Provider）
│   └── globals.css        # 设计令牌（Anatole）+ 组件类
├── components/            # PostCard/评论/主题切换/搜索框/Markdown 渲染
├── lib/                   # db/auth/constants/settings/scheduler/site
├── middleware.ts          # /admin 与 /api/admin 认证守卫
└── instrumentation.ts     # node-cron 定时发布
```

## SEO 与订阅

- `/sitemap.xml`：文章/分类/标签自动生成（动态渲染，新文章即时收录）
- `/rss.xml`：RSS 2.0 订阅源（最新 20 篇）
- `/robots.txt`：放行全部 + sitemap 声明
- 文章详情页动态 OG 标签（标题/摘要/封面），微信/微博分享有卡片
- 注意：`SITE_URL` 未配置时默认 `http://localhost:3000`，上线前务必改成正式域名

## 部署提示

- 生产构建：`npm run build && npm start`（已验证；构建不依赖外网，字体为系统栈）
- `.env` 配置 `SITE_URL` 为正式域名（sitemap/RSS/OG 链接基准）
- 上传的媒体存在 `public/uploads/`，生产环境建议挂载持久化卷；启用云存储插件后媒体改存云端（`uploads.url` 为完整 URL），本地不再落盘
- 若上传大文件超限：站点设置中调高"上传大小限制"后，还需同步调大反向代理请求体上限（如 nginx `client_max_body_size 50m;`）
- 定时发布依赖常驻进程（instrumentation 中的 cron）；若无常驻进程，前台查询层兜底（`publishedAt <= NOW()`）仍不会提前暴露文章
- `.env` 中的 `AUTH_SECRET` 必须更换为强随机值

### PM2 常驻（Linux 服务器）

```bash
npm ci && npm run build
pm2 start ecosystem.config.cjs && pm2 save
pm2 startup            # 开机自启（按提示执行输出的命令）
```

定时发布调度器已内嵌在服务启动钩子中，PM2 托管一个进程即可。反向代理示例（nginx → 3000 端口）：

```nginx
server {
    listen 80;
    server_name blog.example.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 已知说明

- **Windows Turbopack 兼容**：`next dev` 使用 webpack（`next dev --webpack`），Turbopack 在 Windows 上会报 junction 错误（@prisma/client、bcryptjs）；`next build` 默认 Turbopack 可正常构建
- **无 Google Fonts 依赖**：曾因 fonts.googleapis.com 不可达导致 build 失败，已改为系统字体栈（`next/font/google` 构建期会强制联网，勿重新引入）
- **中文 slug**：Next.js 16 对路径参数不做 URL 解码，中文 slug 已在 post/category/tag 页面手动 `decodeURIComponent`（已验证）
- **Server Action 参数**：BigInt id 需以字符串传递（React Flight 无法序列化 BigInt），actions 内再 `BigInt()` 转换
- `middleware.ts` 在 Next 16 建议改名为 `proxy.ts`（仅警告，不影响功能）

## 运维注意

- **每次 `prisma migrate dev` 后必须重建全文索引**：Prisma 会把手动创建的 FULLTEXT 索引视为 drift 并在迁移中 `DROP INDEX`（迁移 20260801102532 就干过这事）。迁移后执行：

  ```sql
  ALTER TABLE posts ADD FULLTEXT INDEX ft_posts_search (title, excerpt, content) WITH PARSER ngram;
  ```

  否则前台中文全文搜索会静默失效。验证：`SHOW INDEX FROM posts WHERE Key_name = 'ft_posts_search'`

- **浏览量去重**：前台浏览量由客户端 `POST /api/post-view` 上报，按文章 id 下发 7 天 httpOnly cookie（`blog_viewed_<id>`），同一浏览器 7 天内不重复计数。清 cookie 或换设备会再计数，属预期。

- **评论回复**：评论表 `parent_id` 自关联（级联删除）。前台只能回复已审核通过的评论；回复同样进入审核队列（若开启审核）。后台审核列表会标注"回复 @xxx"上下文。

- **评论反垃圾**：三道防线——无 `User-Agent` 或疑似爬虫 UA 直接拒绝；同一 IP 两次评论间隔 ≥5 秒（超限返回 429）；同一文章 + 昵称 + 内容 1 小时内判为重复拒绝提交。

- **后台文章管理增强**：列表支持分类筛选（含"未分类"）、5 种排序（最新发布/最近更新/置顶优先/浏览最多/评论最多）、标题/内容关键字搜索、每页 10/20/50 条（偏好经 cookie 持久化）；状态 Tab 显示各状态计数；**批量操作**（勾选后出现操作栏）：立即发布 / 转草稿 / 置顶 / 取消置顶 / 移动到分类 / 移入回收站，操作会写入审计日志（如"批量置顶 2 篇"）。

- **回收站防误删**：删除文章改为软删除（`deleted_at` 置位，移入回收站），前台所有查询（首页/详情/归档/分类/标签/搜索/RSS/sitemap/相关推荐/定时发布）均排除已删除文章，回收站中恢复后前台立即可见；回收站内支持恢复与**彻底删除**（不可恢复，二次确认）。彻底删除仅对回收站中的文章生效。

- **图片文件库**：`/admin/uploads` 统一管理上传图片（48 张/页）——预览、**复制 URL**、新窗口打开、删除（同时移除磁盘文件，含路径穿越防护）。上传时经 **sharp 自动压缩**：PNG → PNG(9) / WebP → WebP(82) / 其余 → JPEG(82, mozjpeg)，EXIF 自动校正、超 1920px 等比缩到 1920；GIF/SVG 原样保留；压缩失败自动回退原图。上传记录入库（`uploads` 表），编辑器传图与文件库共用同一套压缩逻辑。

- **Markdown 批量导入**：`/admin/posts/import` 一次最多导入 50 个 .md 文件（单文件 ≤1MB），支持 `--- title / date / tags ---` frontmatter（无 frontmatter 时用文件名），可批量存草稿或直接发布（发布时优先用 frontmatter 的 date 作为发布时间），重复 slug 自动追加 `-2/-3`，标签自动复用/创建；逐文件容错，结果页显示成功/失败明细。

- **编辑器快捷键**：文章/页面编辑页支持 **Ctrl+S（Mac ⌘S）快速保存草稿**，无需手动点击"保存草稿"按钮。

- **评论闭环**：① **被回复邮件通知**——评论者可在表单勾选"有人回复我时邮件通知"，被回复后系统向其邮箱发通知（需开启站点设置中的邮件通知并配置 SMTP）；② **评论点赞**——游客可点赞，`liked_comments` cookie 记录（最多 200 个，一年有效）防刷，客户端乐观更新；③ **评论分页**——顶层评论每页 20 条，`?cpage=N` 深链，回复递归加载最多 5 层。

- **文章置顶**：编辑页勾选"置顶文章"，前台列表（首页/分类/标签/搜索）按 `isPinned DESC, publishedAt DESC` 排序并显示「置顶」徽标。

- **仪表盘图表**：工作台内置近 14 天发文趋势（SVG 柱状图）与分类分布（文章数 + 浏览量），零依赖，颜色跟随亮/暗主题。

- **评论通知**：每次新评论/新回复生成站内通知（后台侧边栏铃铛徽标 + `/admin/notifications` 列表页，支持单条/全部已读）。邮件通知为可选：站点设置开启"邮件通知"并在 `.env` 配置 `SMTP_HOST/PORT/USER/PASS/FROM` 后生效，发信失败静默不影响评论流程。

- **相关文章推荐**：详情页底部按「同分类 OR 共享标签」推荐 5 篇（置顶优先、按发布时间倒序），无匹配时不显示该区块。

- **审计日志**：`/admin/audit`（仅管理员）记录登录成功/失败、退出、文章/分类/标签增删改、评论审核与删除、设置修改、用户角色变更；含操作者、目标、详情与 IP（生产环境经 Nginx `X-Forwarded-For` 透传）。登录失败也会留痕（含尝试的用户名），便于发现暴力破解。日志表 `audit_logs` 不自动清理，长期运行建议定期归档。
