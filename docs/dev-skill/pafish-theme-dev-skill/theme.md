# pafish 主题开发文档

pafish 博客 CMS 主题开发完整参考。主题以**目录即应用**方式落地：`<项目根>/themes/{name}/` 下放 `theme.json`（manifest + 设置 schema）与可选的 `theme.css`（CSS 语义变量覆盖）。主题不引入动态模板（RSC 无法动态加载 JSX 模块图），**视觉切换靠 CSS 变量覆盖 + 前台组件读取设置值**。

> 配套可运行示例见 `./assets/demo-theme/`；速查版见 `./SKILL.md`。

## 1. 目录结构与 manifest

```
themes/demo-nord/
├── theme.json   # manifest + 设置 schema
└── theme.css    # 可选：语义变量覆盖（浅色 :root + 深色 .dark）
```

### 命名规范

- 主题名（目录名 = manifest.name）：`/^[a-z0-9_-]{1,50}$/`，如 `default`、`demo-nord`、`paper`
- 主题名即身份：设置键 `theme:{key}`、激活状态 `active_theme` 都以目录名为准；`default` 为内置兜底主题（不存在时回退）

### theme.json

```json
{
  "name": "my-theme",
  "title": "我的主题",
  "version": "1.0.0",
  "description": "一句话说明",
  "author": "pafish",
  "settings": []
}
```

| 字段 | 必填 | 说明 |
| :--- | :--- | :--- |
| `name` | ✅ | 与目录名一致，过 `/^[a-z0-9_-]{1,50}$/` |
| `title` | ✅ | 主题显示名 |
| `version` | ✅ | 版本号（商店更新按 `.` 分段数字比较，容忍 `v` 前缀） |
| `description` / `author` | 可选 | 主题列表展示 |
| `settings` | 可选 | 设置 schema 数组（见下） |
| `pageTemplates` | 可选 | 页面模板声明数组（见 2.5），创建页面时下拉可选 |

## 2. 设置 schema — 8 字段类型

后台「主题与外观 → 设置」页由 SchemaForm 根据 `settings` 自动生成。设置值存 `theme:{key}`（字符串）。

### 类型表

| 类型 | 表单控件 | 值 | 附加字段 |
| :--- | :--- | :--- | :--- |
| `text` | 输入框 | 字符串 | `default`、`placeholder` |
| `textarea` | 多行文本 | 字符串 | `default`、`placeholder` |
| `checkbox` | 复选框 | `"1"` / `"0"` | `default` |
| `select` | 下拉 | 选项值 | `options`、`default` |
| `color` | 取色器 + hex 输入 | `#rrggbb` | `default` |
| `switcher` | 滑动开关 | `"1"` / `"0"` | `default` |
| `radio` | 胶囊单选组 | 选项值 | `options`、`default` |
| `image` | 媒体库/上传选择 | `/uploads/...` 相对路径 | 无 |

### group（Tab 分组）

`group` 为字符串分组名，设置页按首现顺序渲染 Tab；缺省归入"常规"，仅一组时无 Tab 栏。

### show_if（等值联动）

```json
{ "key": "show_badge", "label": "显示徽章", "type": "switcher", "group": "内容", "default": "1" },
{ "key": "badge_text", "label": "徽章文字", "type": "text", "group": "内容",
  "show_if": { "key": "show_badge", "value": "1" } }
```
依赖字段值匹配时才显示（客户端即时生效，无需保存）。

### 设置默认值

`getThemeValues()` 返回：schema 声明的键 = `default ?? ""`（checkbox 类型默认 `"0"`）+ `theme:{key}` 已存值覆盖。**未在 schema 中声明的键不会被读取**。

### 2.5 页面模板（pageTemplates）— 对标 emlog page_*.php

主题可在 theme.json 声明页面模板，后台创建/编辑页面时「模板」下拉可选（默认 + 激活主题声明 + 激活插件声明）。主题无动态模板能力（纯 CSS/JSON），因此**主题模板 = 模板名 + CSS 分发**：

- 前台渲染容器自动带 `data-page-template="{name}"` 属性与 `page-template-{name}` 类（非 default 模板时）
- 主题 CSS 用属性/类选择器定义该模板的布局差异；未匹配的页面仍是默认容器（max-w-3xl 内容区）

```json
{
  "name": "my-theme",
  "title": "我的主题",
  "version": "1.0.0",
  "pageTemplates": [
    { "name": "wide", "title": "宽版页", "description": "内容区放宽到 1100px" }
  ]
}
```

```css
/* theme.css */
[data-page-template="wide"] { max-width: 1100px; }
```

- 模板名白名单 `/^[a-z0-9-]{1,40}$/`，**不可占用系统保留名 `default`**；声明无效（缺 name/title、非数组）会导致 manifest 校验失败
- 首页设为自定义页面时同样按模板分发
- **动态 HTML 渲染模板由插件提供**（plugin.json `pageTemplates` + `renderPageTemplate`，见插件文档 4.4）；同名模板前台插件渲染优先于主题 CSS 分发

## 3. CSS 语义变量（theme.css 换肤）

前台布局已全部使用语义 token（背景/文字/边框/强调色等），`theme.css` 覆盖这些变量即可整体换肤：

| 变量 | 用途 |
| :--- | :--- |
| `--bg` | 页面背景 |
| `--fg` | 正文 |
| `--muted` | 次要文字 |
| `--card` | 卡片 / 侧边栏 / 顶栏背景 |
| `--border` | 边框 |
| `--accent` | 强调色（链接 / 按钮 / 激活态） |
| `--accent-soft` | 强调色浅底（hover / 选中） |
| `--danger` | 危险 / 错误 |
| `--title` | 标题 |
| `--meta` | 时间 / 元信息 |
| `--side` | 侧边栏次要文字 |

示例（`paper` 主题的暖白纸感配色）：

```css
:root {
  --bg: #f7f2e9; --fg: #5b5346; --muted: #94897a; --card: #fffdf7;
  --border: #e9dfcc; --accent: #b08968; --accent-soft: rgba(176, 137, 104, 0.12);
  --danger: #c05a4d; --title: #3e3628; --meta: #b3a794; --side: #6b6353;
}
.dark { /* 深色模式同键覆盖，如 Nord 极夜的 #2e3440 系 */ }
```

### 注入机制

- 主题 CSS 通过 `<style data-theme="{name}">` 注入在**前台** (public) 布局 body 顶层（任意 DOM 位置 style 生效）
- **后台（/admin、/login、/register）始终使用默认配色**，不受主题影响——这是硬性设计（后台一致性）
- 深色模式：前台有主题切换按钮，`.dark` 类在根元素切换，主题需同时提供浅色与深色两套变量

## 4. 前台接线（设置值消费）

设置驱动的文案/开关需要前台代码主动读取。参考 `src/app/(public)/layout.tsx` 的消费方式：

```tsx
import { getThemeValues } from "@/lib/theme";

const theme = await getThemeValues();
const showSidebar = theme.sidebar_enabled !== "0";
// 页脚文案：theme.footer_text 有值则显示，留空用默认
```

已示范的消费点（新主题可直接沿用）：
- `footer_text`：页脚文案（前台布局 footer）
- `sidebar_enabled`：桌面侧边栏开关（前台布局）
- 其他键（如 `logo_image`、`accent_color`）由需要的前台组件读取

> 修改前台组件消费设置时，注意只改前台文件（`src/app/(public)/**` 与前台组件），后台页面不得依赖主题设置。

## 5. 主题设置页与导入导出

- 激活主题：后台「主题与外观」卡片点「设置」→ `/admin/appearance/{name}`（仿插件设置页）
- 非激活主题：显示"启用后可配置"（`theme:{key}` 命名空间共享，仅激活主题生效）
- **导入导出**：设置页提供 JSON 备份（`{ format: "blogcms-theme-settings", theme, exportedAt, values }`）；导入会校验 format / theme 与当前激活主题一致 / 值过 schema 白名单，非法文件一律拒绝

## 6. 激活 / 卸载语义

- 切换主题：后台「主题与外观」→ 启用（写 `active_theme`，前台立即换肤）
- 卸载：删除主题目录；只删除"该主题独有、其他已装主题不用"的 `theme:{key}` 键；**正在使用的主题不可卸载**
- 更新（商店）：原子覆盖目录，设置保留不动

## 7. 发布与商店

与插件同套打包协议：

1. **唯一顶层目录** = 主题名：`my-theme/theme.json`（+ `theme.css`）；不得有第二个顶层目录
2. 大小 ≤ 10MB；路径禁止穿越（`..`、盘符、空段）与反斜杠
3. 安装/更新后校验 manifest（name 与目录一致 + title/version 存在），失败自动回滚

构建内置商店（项目根目录，幂等可重复）：

```bash
node scripts/build-store.cjs
```

- 打包 `store-src/{name}/`（或现有 `themes/{name}/`）→ `public/store/{name}.zip`
- 生成 `public/store/themes.json`（顶层条目数组：`{ name, title, version, description, author, zip, preview? }`）
- `preview` 可放 `/store/{name}.png` 缩略图（无则显示占位）
- 远程商店源：后台「站点设置 → 应用商店地址」配置 base URL，其下提供 `themes.json` / `plugins.json`
- **私有源鉴权（可选）**：同页「商店访问令牌」配置后，目录与 zip 请求携带 `Authorization: Bearer <token>`（服务端 fetch，不暴露给浏览器）；401/403 时商店页提示"令牌无效或源要求授权"。最小鉴权源示例见 `../pafish-plugin-dev-skill/plugin.md`
- 商业提示：主题为纯 CSS/JSON，无法做应用层授权校验，**不适合付费分发**；私有源鉴权适合限免/定向分发场景

## 8. 开发流程建议

1. 复制 `./assets/demo-theme/` 到 `themes/{name}/` 起手，改名与字段
2. 写 `theme.css` 覆盖语义变量（浅色 + 深色），先看效果
3. 按需扩 `settings` schema（group 分组、show_if 联动）；前台组件用 `getThemeValues()` 消费
4. 后台「主题与外观」→ 启用 → 验证前台配色与设置生效；确认 `/admin` 配色未受影响
5. 发布：放入 `store-src/{name}/` → `node scripts/build-store.cjs` → 商店页可安装

## 9. 排错速查

| 现象 | 原因/处理 |
| :--- | :--- |
| 主题列表显示"缺少 theme.json" | manifest 缺 name/title/version 或 name 与目录名不一致 |
| 前台没换肤 | 确认已启用（active_theme）、theme.css 在主题目录内、前台布局有 `<style data-theme>` |
| 后台配色被主题影响 | 主题 CSS 只能出现在 (public) 布局；检查是否误改全局 globals.css 或后台文件 |
| 设置保存了前台没变化 | 前台组件需读取 `theme:{key}` 并消费；确认键在 schema 中声明过 |
| 设置页 Tab 不显示 | 所有字段都在同一 group（或全部缺省"常规"）时无 Tab 栏，属正常 |
| 商店安装/更新失败 | zip 顶层目录 ≠ 主题名、超 10MB、含非法路径、manifest 无效（均自动回滚） |

## 参考

- 示例主题：`default`（项目 `themes/default/`）、`demo-nord`（7 字段完整演示：group/show_if/color/switcher/radio/image）、`paper`（商店内置主题）
- 主题系统实现：`src/lib/theme.ts`
- 设置表单实现：`src/components/admin/schema-form.tsx`
