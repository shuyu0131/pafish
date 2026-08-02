---
name: "pafish-plugin-dev"
description: "协助创建和迭代 pafish 博客 CMS 的插件。当用户想要创建新插件、修改迭代插件、询问 pafish 插件 API / 事件钩子 / 设置 schema / 商店打包时调用。"
---

# pafish 插件开发助手

此 Skill 旨在帮助您开发 pafish 博客 CMS 的插件，包含最新的开发规范和接口文档。
完整文档：`./plugin.md`，可运行示例：`./assets/demo-plugin/`（示例真实可用，可直接装入项目验证）。

## 插件结构与规范

### 目录结构
插件位于 `<项目根>/plugins/<plugin_name>/` 目录下，**目录即应用**。

| 文件 | 说明 |
| :--- | :--- |
| `plugin.json` | manifest（名称/标题/版本/作者/描述）+ 设置 schema |
| `index.mjs` | 插件代码（原生 ESM，零转译依赖，Node 动态加载） |

### 命名规范
- 插件名（目录名 + manifest.name）：仅小写字母/数字/下划线/连字符，1–50 字符（`/^[a-z0-9_-]{1,50}$/`），如 `demo-hooks`、`hello-pafish`
- 插件名即身份：设置键 `plugin_settings:{name}`、数据键 `plugin_data:{name}`、钩子来源标记 `plugin:{name}` 均以目录名为准

### 设置 schema（plugin.json → settings）
| 类型 | 说明 |
| :--- | :--- |
| `text` | 单行文本（`default` / `placeholder`） |
| `textarea` | 多行文本 |
| `checkbox` | 复选框（值 `"1"` / `"0"`） |
| `select` | 下拉（`options`: 值 → 显示名） |

后台设置页由 SchemaForm 自动生成（插件设置入口：后台 → 插件管理 → 设置）。

### 注入点位（manifest → injects）
`["head", "footer", "sidebar"]`——声明插件向前台哪些位置注入 HTML；与 `renderInjection(target, ctx)` 配合。

## 插件模块 API（index.mjs 导出的函数）

### 事件钩子注册
```js
export function registerHooks(ctx) {
  ctx.on("after_create_post", (post) => {
    console.log(`文章发布：${post.title}`);
  }, 10); // priority 越小越先执行，默认 10
}
```
钩子只在 **node runtime**（server action / route handler / 服务端工具）触发；前台 RSC 无法动态加载插件代码，需要前台内容的插件请走**注入管线**。

### 生命周期
```js
export function onActivate(ctx)   { /* 启用时（初始化数据等） */ }
export function onDeactivate(ctx) { /* 停用时 */ }
export function onUninstall(ctx)  { /* 卸载时（清理自建数据，绿色插件） */ }
```

### 前台注入（渲染缓存模式）
```js
export function renderInjection(target, ctx) {
  if (target === "footer") return `<p>插件页脚</p>`;
  return "";
}
```
返回的 HTML 由系统写入 `plugin_inject_head/footer/sidebar` 并供 RSC 输出；head 只允许 `script` / `meta` / `link` / `style` 元素。设置变更后调用 `ctx.refreshInjections()` 重新渲染。

## PluginContext API（ctx）

| 方法 | 说明 |
| :--- | :--- |
| `ctx.name` | 插件名 |
| `ctx.on(name, fn, priority?)` | 注册事件钩子（返回注销函数） |
| `ctx.getData()` / `ctx.setData(obj)` | 读写插件自有数据（JSON 对象，存 `plugin_data:{name}`） |
| `ctx.getSettings()` / `ctx.setSettings(partial)` | 读写设置（schema 表单值，存 `plugin_settings:{name}`） |
| `ctx.log(message)` | 追加一条日志到插件数据 `logs` 数组（最多 50 条，插件列表可查看） |
| `ctx.refreshInjections()` | 重新渲染前台注入缓存（设置变更后调用） |

## 事件钩子参考（12 个点位）

| 钩子 | 触发时机 | 载荷 |
| :--- | :--- | :--- |
| `after_create_post` | 文章创建后 | postPayload（见下） |
| `after_update_post` | 文章更新后 | postPayload |
| `after_delete_post` | 文章移入回收站 | postPayload |
| `after_purge_post` | 文章彻底删除 | postPayload |
| `after_comment_submit` | 访客提交评论 | `{ id, postId, author, email, content, status, parentId }` |
| `after_comment_status` | 评论审核状态变更 | `{ id, postId, from, to }` |
| `after_comment_delete` | 评论删除 | `{ id, authorName }` |
| `after_comment_reply` | 管理员回复评论 | `{ parentId, postId, author, content }` |
| `after_login` | 用户登录成功 | `{ id, username, role }` |
| `after_logout` | 用户退出 | `{ id }` |
| `after_register` | 用户注册成功 | `{ id, username }` |

postPayload 字段（文章类钩子统一载荷，id 与 categoryId 已转为字符串）：
`{ id, title, slug, status, publishedAt, categoryId, externalUrl, isPinned, categoryPinned }`

## 常用代码片段

### 文章发布后写日志
```js
export function registerHooks(ctx) {
  ctx.on("after_create_post", (post) => {
    ctx.log(`文章发布：${post.title}（id=${post.id}）`);
  });
}
```

### 侧边栏注入欢迎语（读取设置）
```js
export function renderInjection(target, ctx) {
  if (target !== "sidebar") return "";
  return `<div class="card p-4 text-sm">👋 ${ctx.name} 注入的侧边栏内容</div>`;
}
```

## 发布到应用商店（zip 打包）

打包协议与安装校验（安装/更新/商店通用）：

- **zip 结构**：唯一顶层目录 = 插件名（`my-plugin/plugin.json` + `my-plugin/index.mjs`），不得有第二个顶层目录
- **大小上限**：10MB
- **禁止**：路径穿越（`..`、盘符、空段）、反斜杠路径、包名不合法
- **manifest 校验**：安装/更新后校验 plugin.json 的 name 与目录一致 + title/version 存在，否则回滚

内置商店构建（项目根目录执行，幂等可重复）：
```bash
node scripts/build-store.cjs
```
- 打包 `store-src/{name}/`（或现有 `plugins/{name}/`）→ `public/store/{name}.zip`
- 生成 `public/store/plugins.json`（顶层为条目数组：`{ name, title, version, description, author, zip, preview? }`）
- 远程商店源：后台「站点设置 → 应用商店地址」配置 base URL，其下提供 `themes.json` / `plugins.json`

## 最佳实践

- **绿色插件**：不修改系统核心表与核心文件；卸载时用 `onUninstall` 清理自建数据（设置与数据键系统会随卸载自动删除）
- **设置变更记得 `ctx.refreshInjections()`**，否则前台注入缓存不更新
- **钩子载荷是快照**：`postPayload` 已序列化为插件友好结构（BigInt 转字符串），直接使用即可
- **日志有上限**：`ctx.log` 最多保留 50 条，按需自行落盘插件数据
- **兼容 ESM**：index.mjs 用原生 ESM 语法（export/import），不使用 require / TS 语法

## 参考文档

- pafish 插件开发完整文档：`./plugin.md`
- 可运行插件示例：`./assets/demo-plugin/`
- 主题开发（含设置 schema 8 类型）：`../pafish-theme-dev-skill/SKILL.md`
