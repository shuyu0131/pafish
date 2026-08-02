# pafish 插件开发文档

pafish 博客 CMS 插件开发完整参考。插件以**目录即应用**方式落地：`<项目根>/plugins/{name}/` 下放一个 `plugin.json`（manifest + 设置 schema）与一个 `index.mjs`（原生 ESM 插件代码），后台「插件管理」即可启用/停用/卸载，无需重启构建。

> 配套可运行示例见 `./assets/demo-plugin/`；速查版见 `./SKILL.md`。

## 1. 架构总览

pafish 是 Next.js App Router 全栈应用，插件分两条执行路径：

```
┌─ node runtime（server action / route handler / 服务端工具）
│   ensurePluginHooks() 按 DB 激活列表懒注册插件钩子
│   doAction("after_xxx", payload)   → 广播给所有注册了该钩子的插件
│
└─ 前台注入管线（RSC 无法动态加载插件代码）
    renderInjection(target, ctx) → HTML 字符串
    → 系统拼接写入 settings（plugin_inject_head/footer/sidebar）
    → 前台布局 RSC 读值输出到 <head> / 页脚 / 侧边栏
```

两条路径互不影响：**钩子**在 node runtime 实时触发；**注入**是"渲染缓存"模式（设置变更后调用 `ctx.refreshInjections()` 刷新）。

## 2. 目录结构与 manifest

```
plugins/demo-hooks/
├── plugin.json   # manifest + 设置 schema
└── index.mjs     # 插件代码（ESM）
```

### 命名规范

- 插件名（目录名 = manifest.name）：`/^[a-z0-9_-]{1,50}$/`（小写字母/数字/下划线/连字符），如 `demo-hooks`
- 插件名即身份：设置键 `plugin_settings:{name}`、数据键 `plugin_data:{name}`、钩子来源标记 `plugin:{name}`、日志/数据都以目录名为准

### plugin.json

```json
{
  "name": "my-plugin",
  "title": "我的插件",
  "version": "1.0.0",
  "description": "一句话说明",
  "author": "pafish",
  "settings": [],
  "injects": ["head", "footer", "sidebar"]
}
```

| 字段 | 必填 | 说明 |
| :--- | :--- | :--- |
| `name` | ✅ | 必须与目录名一致，过 `/^[a-z0-9_-]{1,50}$/` |
| `title` | ✅ | 插件显示名 |
| `version` | ✅ | 版本号字符串（商店更新用 `compareVersions` 比较，按 `.` 分段数字比较，容忍 `v` 前缀） |
| `description` / `author` | 可选 | 列表页展示 |
| `settings` | 可选 | 设置 schema 数组（见下） |
| `injects` | 可选 | 声明前台注入点位，`"head" | "footer" | "sidebar"` 的数组 |
| `pageTemplates` | 可选 | 页面模板声明数组（见 4.4），创建页面时下拉可选 |
| `pages` | 可选 | 插件前台页面声明数组（见 4.5） |

## 3. 设置 schema

后台「插件管理 → 设置」页由 SchemaForm 根据 `settings` 自动生成（保存后值存 `plugin_settings:{name}`，并提示调用 `ctx.refreshInjections()` 刷新前台注入）。

### 字段类型（插件 5 类型）

| 类型 | 值 | 附加字段 |
| :--- | :--- | :--- |
| `text` | 字符串 | `default`、`placeholder` |
| `textarea` | 字符串（多行） | `default`、`placeholder` |
| `checkbox` | `"1"` / `"0"` | `default`（如 `"1"`） |
| `select` | 选项值字符串 | `options`（值 → 显示名）、`default` |
| `password` | 字符串（密码框） | `default`、`placeholder`；值明文存 settings 表，适合密钥类配置 |

```json
{
  "key": "show_widget",
  "label": "显示组件",
  "type": "checkbox",
  "default": "1"
},
{
  "key": "widget_position",
  "label": "组件位置",
  "type": "select",
  "default": "footer",
  "options": { "footer": "页脚", "sidebar": "侧边栏" }
},
{
  "key": "secret_key",
  "label": "API 密钥",
  "type": "password",
  "placeholder": "仅保存在服务器"
}
```

> 主题设置另有 `color` / `switcher` / `radio` / `image` 四类及 `group` 分组、`show_if` 联动（见主题文档），插件侧当前为 5 类型。

## 4. 插件模块 API（index.mjs）

index.mjs 为**原生 ESM**（`export function ...`），由 Node 运行期动态加载（webpackIgnore，不参与前端打包）。

### 4.1 registerHooks(ctx) — 注册事件钩子

启用时与进程启动预热时被调用；`ctx.on()` 注册的钩子带来源标记 `plugin:{name}`，插件停用自动批量注销。

```js
export function registerHooks(ctx) {
  ctx.on("after_create_post", (post) => ctx.log(`文章发布：${post.title}`));
  ctx.on("after_comment_submit", (c) => ctx.log(`收到评论：${c.author}`), 5); // priority 越小越先
}
```

### 4.2 生命周期回调

```js
export async function onActivate(ctx)   { /* 启用：初始化数据、首次渲染注入 */ }
export async function onDeactivate(ctx) { /* 停用 */ }
export async function onUninstall(ctx)  { /* 卸载：清理自建数据（绿色插件） */ }
```

系统在启用/停用/卸载时调用对应函数并传入完整 ctx。卸载时系统自动删除 `plugin_settings:{name}` 与 `plugin_data:{name}` 键。

### 4.3 renderInjection(target, ctx) — 前台注入

返回 `string`（HTML 片段），按 `injects` 声明（或系统遍历全部点位）渲染：

```js
export function renderInjection(target, ctx) {
  if (target === "sidebar") return `<div class="card p-4 text-sm">侧边栏组件</div>`;
  return "";
}
```

- 非空返回值按点位拼接后写入 `plugin_inject_head` / `plugin_inject_footer` / `plugin_inject_sidebar`
- **head 白名单**：只允许 `script` / `meta` / `link` / `style` 元素，其余 HTML 会被忽略（脚本支持 `src` 与内联）
- footer / sidebar 输出原始 HTML

### 4.4 renderPageTemplate(template, page, ctx) — 页面模板渲染（对标 emlog page_*.php）

页面模板机制：后台创建/编辑页面时，「模板」下拉可选系统默认、激活主题声明的模板、激活插件声明的模板。插件模板由本函数在 node runtime 渲染（HTML 缓存管线，与注入同模式），前台输出。

```js
// plugin.json
{ "pageTemplates": [{ "name": "card", "title": "卡片页" }] }

// index.mjs
export function renderPageTemplate(template, page) {
  if (template !== "card") return null;           // 不是自己的模板 → 返回 null 交给后续
  return `<div class="my-card">${escapeHtml(page.title)}</div>`;
}
```

- 只处理自己声明的模板名，其余返回 `null`（系统按激活顺序尝试各插件，首个非空生效）
- `page` 载荷：`{ slug, title, content }`（content 为 Markdown 原文）
- 返回值经 `refreshPluginPages()` 写入 `page_template:{slug}` 缓存；页面保存/删除、插件启停、服务器启动时全量重渲染
- 模板名白名单 `/^[a-z0-9-]{1,40}$/`，且不可占用系统保留名 `default`
- 模板选项冲突：同一模板名被主题和插件同时声明时，后台下拉并列显示（带来源标注），前台插件渲染优先于主题 CSS 分发

### 4.5 renderPluginPage(path, ctx) — 插件前台页面（对标 emlog <alias>_show.php）

插件可提供独立前台页面，URL 为 `/plugin/<插件名>/<path>`（path 缺省 = `index`）。

```js
// plugin.json
{ "pages": [{ "path": "hello", "title": "打招呼页" }] }

// index.mjs
export async function renderPluginPage(path, ctx) {
  if (path !== "hello") return null;
  const data = await ctx.getData();
  return `<h1>Hello!</h1><p>插件日志 ${data.logs?.length ?? 0} 条</p>`;
}
```

- 渲染结果套用站点公共壳（站点名/导航/主题 CSS/head+footer 注入），返回完整 HTML 页面
- 插件未启用、未声明该 path、path 含非法字符（白名单 `/^[a-z0-9_-]{1,50}$/` 单段）→ 404
- 多页面：声明多个 `pages` 条目即可；path 为单段，不支持子路径

### 4.6 PluginContext 完整 API

| 成员 | 签名 | 说明 |
| :--- | :--- | :--- |
| `name` | `string` | 插件名 |
| `on` | `(hookName, fn, priority?) => () => void` | 注册钩子，返回注销函数；priority 默认 10 |
| `getData` | `() => Promise<object>` | 读取插件自有数据（JSON 对象） |
| `setData` | `(data) => Promise<void>` | 整体覆盖写入插件数据 |
| `getSettings` | `() => Promise<object>` | 读取设置值（schema 表单值，字符串映射） |
| `setSettings` | `(partial) => Promise<void>` | 合并写入部分设置 |
| `log` | `(message) => Promise<void>` | 追加日志到 `logs` 数组（最多 50 条，超限裁旧），后台插件列表可展开查看 |
| `refreshInjections` | `() => Promise<void>` | 重新渲染全部激活插件的注入内容并写库 |

### 4.7 存储后端（云存储插件）

插件可声明为系统的**云存储后端**：媒体上传自动改走云端（成功则不落本地磁盘），删除媒体时同步删除云端文件；上传失败自动回退本地磁盘（与"压缩失败回退原图"同容错哲学）。

#### manifest 声明

```json
{
  "name": "binfen-storage",
  "storage": { "title": "缤纷云 S4" }
}
```

`storage` 为对象且 `title` 为字符串才生效；未声明该字段的插件不参与存储路由。

#### index.mjs 导出

```js
// 上传：成功返回 { url }（完整公开 URL，如 https://cdn.example.com/2026/08/xx.png）
// 返回 null / 缺 url / 抛错 → 系统视为失败并回退本地磁盘
export async function storeFile(file, ctx) {
  const s = await ctx.getSettings(); // 每次调用实时读取，改设置无需重启
  return { url: `https://.../${key}` };
}

// 删除：从 url 反解对象 key 并删除；失败抛错会被系统静默（只记日志）；
// 云上已不存在（404）建议视为成功
export async function deleteFile(url, ctx) {
  /* 签名 DELETE */
}
```

`file` 载荷：`{ buffer: Buffer, ext, mime, originalName, size, width, height }`（图片已压缩，width/height 为 null 表示非图片）。

#### 系统侧语义

- **路由**：激活插件中第一个「声明 storage 且导出 storeFile」的生效；停用/卸载即自动让位回本地存储
- **上传**：`POST /api/upload` sharp 压缩后先走 `storeFile`；成功 → 媒体库 `uploads.url` 存完整 URL（前台/编辑器天然兼容，无需改写）；失败 → 原本地磁盘逻辑
- **删除**：`deleteUpload` 识别 url 以 `http(s)://` 开头 → 调 `deleteFile`；本地相对路径 → 原磁盘删除（防路径穿越）
- **接入点**：`src/lib/plugin-storage.ts`（`storeToCloud` / `deleteFromCloud`）

> 安全提示：密钥类设置（如 SecretKey）用 `password` 类型字段，值明文存 `plugin_settings:{name}`（与站点其他敏感配置同级），生产环境注意数据库与备份安全。

## 5. 事件钩子全表

所有点位均为 `doAction`（广播式：所有注册函数依次执行，单个异常隔离不影响主流程）。

| 钩子 | 触发时机 | 载荷字段 |
| :--- | :--- | :--- |
| `after_create_post` | 文章创建成功后 | postPayload |
| `after_update_post` | 文章更新后 | postPayload |
| `after_delete_post` | 文章移入回收站后 | postPayload |
| `after_purge_post` | 文章彻底删除后 | postPayload |
| `after_comment_submit` | 前台评论提交成功 | `{ id, postId, author, email, content, status, parentId }` |
| `after_comment_status` | 后台评论审核状态变更 | `{ id, postId, from, to }` |
| `after_comment_delete` | 评论删除 | `{ id, authorName }` |
| `after_comment_reply` | 管理员回复评论 | `{ parentId, postId, author, content }` |
| `after_login` | 用户登录成功 | `{ id, username, role }` |
| `after_logout` | 用户退出登录 | `{ id }` |
| `after_register` | 用户注册成功（自动登录） | `{ id, username }` |

**postPayload 结构**（文章类统一载荷，id / categoryId 已序列化为字符串）：

```ts
{
  id: string;              // 文章 ID
  title: string;
  slug: string;
  status: string;          // "published" | "draft" | ...
  publishedAt: Date | null;
  categoryId: string | null;
  externalUrl: string | null;
  isPinned: boolean;
  categoryPinned: boolean;
}
```

> 评论载荷中的 `status` 取值为评论状态（如 `pending` / `approved` / `rejected`，对应后台「评论审核」状态）。

## 6. 数据存储

所有插件数据存于 settings 表（键值对），**不建独立表**（绿色插件原则）。

| 键 | 内容 |
| :--- | :--- |
| `plugin_settings:{name}` | 设置 schema 表单值（JSON 对象，值为字符串） |
| `plugin_data:{name}` | 插件自有数据（JSON 对象，`ctx.log` 追加的日志在 `logs` 数组） |
| `plugin_inject_head/footer/sidebar` | 注入管线缓存（系统维护，勿手写） |

## 7. 启用状态

- 激活插件列表存 `active_plugins`（JSON 数组，系统维护）
- 后台「插件管理」启用/停用/卸载；停用自动注销钩子；卸载删除目录 + 数据键
- 服务器启动时对全部激活插件预热注册钩子并刷新注入

## 8. 发布与商店

### zip 打包规范（安装/更新/商店通用校验）

1. **唯一顶层目录** = 插件名：`my-plugin/plugin.json`、`my-plugin/index.mjs`；不得出现第二个顶层目录
2. 大小 ≤ 10MB；路径禁止穿越（`..`、盘符、空段）与反斜杠
3. 安装/更新后校验 manifest（name 与目录一致 + title/version 存在），失败自动回滚

### 内置商店构建

`store-src/{name}/` 下的包（或复用现有 `plugins/{name}/`），执行：

```bash
node scripts/build-store.cjs
```

- 产出 `public/store/{name}.zip` 与 `public/store/plugins.json`（**顶层为条目数组**）
- 条目字段：`{ name, title, version, description, author, zip, preview? }`，`zip` 为相对路径（如 `/store/my-plugin.zip`）
- 幂等：重跑会清空旧 zip/json 再生成

### 远程商店源

后台「站点设置 → 应用商店地址」配置 base URL（http/https），其下提供 `themes.json` 与 `plugins.json`；目录与 zip 下载均 30s 超时。留空使用内置源。

**私有源鉴权（可选）**：同一设置页可配置「商店访问令牌」（`store_token`）。配置后，目录与 zip 下载请求携带 `Authorization: Bearer <token>` 头；源服务器返回 401/403 时商店页提示"令牌无效或源要求授权"。令牌只保存在服务器端（settings 表，设置页以密码框展示），不会出现在页面源码中，浏览器端不可见。公开源留空即可。

最小鉴权源示例（Node，校验 Bearer 后提供静态产物）：

```js
// 私有商店源：校验令牌后提供 themes.json / plugins.json / store/*.zip
const http = require("http");
const fs = require("fs");
const path = require("path");
const TOKEN = "你的令牌";
const STORE_DIR = path.join(__dirname, "public", "store");

http.createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.writeHead(401); res.end(); return;
  }
  let rel = req.url.replace(/^\//, "").replace(/^store\//, "");
  const p = path.resolve(STORE_DIR, rel);
  if (!p.startsWith(path.resolve(STORE_DIR))) { res.writeHead(403); res.end(); return; }
  try {
    res.writeHead(200, { "Content-Type": "application/octet-stream" });
    res.end(fs.readFileSync(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(8877);
```

> 商业提示：源码型应用（插件/主题）无法通过隐藏 zip 防二次分发，行业通行做法是**公开源码 + 授权码（License Key）激活**——插件 `onActivate(ctx)` 中校验授权服务器即可。主题为纯 CSS/JSON，天然不适合付费。私有源鉴权用于"限免/内测/会员定向分发"等场景。

### 更新语义

商店更新为**原子覆盖**：解压到临时目录 → manifest 校验 → 旧目录改名备份 → 新目录就位 → 失败回滚。更新**不触碰设置**（`plugin_settings:{name}` 保留）。

## 9. 开发流程建议

1. 在 `plugins/{name}/` 写 `plugin.json` + `index.mjs`（可先复制 `./assets/demo-plugin/` 起手）
2. 后台「插件管理」→ 启用（钩子立即注册；如需前台注入，`onActivate` 里调用 `ctx.refreshInjections()`）
3. 有设置项 → 后台「插件管理 → 设置」配置，保存后自动提示刷新注入
4. 验证：事件钩子看插件列表「查看插件数据」日志；注入看前台对应位置
5. 发布：放入 `store-src/{name}/` → `node scripts/build-store.cjs` → 商店页可见可安装

## 10. 排错速查

| 现象 | 原因/处理 |
| :--- | :--- |
| 钩子不触发 | 钩子只在 node runtime 生效；确认插件已启用、事件名拼写与全表一致；看 dev server 日志 `[hooks]` 报错 |
| 前台看不到注入内容 | 确认 manifest `injects` 声明了点位、`renderInjection` 返回非空、设置变更后调过 `refreshInjections` |
| head 注入部分元素丢失 | head 只允许 script/meta/link/style |
| 插件列表显示"缺少有效 plugin.json" | manifest 缺 name/title/version 或 name 与目录名不一致 |
| 安装商店包失败 | zip 顶层目录 ≠ 包名、超 10MB、含非法路径、manifest 无效 |
| 插件代码改动不生效 | dev 模式 ESM 有模块缓存，重启 dev server 或重装插件 |

## 参考

- 示例插件：`demo-hooks`（项目 `plugins/demo-hooks/`，事件钩子日志演示）；`binfen-storage`（`store-src/binfen-storage/`，缤纷云 S4 云存储后端）
- 钩子引擎实现：`src/lib/hooks.ts`、`src/lib/plugin-loader.ts`
- 注入管线实现：`src/lib/plugin-injections.ts`
- 存储后端管线实现：`src/lib/plugin-storage.ts`
