---
name: "pafish-theme-dev"
description: "协助创建和迭代 pafish 博客 CMS 的主题。当用户想要创建新主题、修改现有主题、询问 pafish 主题开发规范、设置 schema / CSS 变量换肤 / 商店打包时调用。"
---

# pafish 主题开发助手

此 Skill 旨在帮助您开发 pafish 博客 CMS 的主题，包含最新的开发规范和接口文档。
完整文档：`./theme.md`，可运行示例：`./assets/demo-theme/`（示例真实可用，可直接装入项目验证）。

## 主题结构与规范

### 目录结构
主题位于 `<项目根>/themes/<theme_name>/` 目录下，**目录即应用**。

| 文件 | 说明 |
| :--- | :--- |
| `theme.json` | manifest（名称/标题/版本/作者/描述）+ 设置 schema |
| `theme.css` | 可选。覆盖 CSS 语义变量实现整体换肤（前台 `<style data-theme>` 注入） |

### 命名规范
- 主题名（目录名 = manifest.name）：仅小写字母/数字/下划线/连字符，1–50 字符（`/^[a-z0-9_-]{1,50}$/`），如 `demo-nord`、`paper`
- 主题名即身份：设置键 `theme:{key}`、激活状态 `active_theme` 均以目录名为准

### 设置 schema（theme.json → settings）— 8 字段类型
| 类型 | 说明 |
| :--- | :--- |
| `text` | 单行文本 |
| `textarea` | 多行文本 |
| `checkbox` | 复选框（值 `"1"` / `"0"`） |
| `select` | 下拉（`options`: 值 → 显示名） |
| `color` | 取色器 + hex 输入 |
| `switcher` | 开关（`role="switch"` 滑动开关，值 `"1"` / `"0"`） |
| `radio` | 胶囊单选组（`options`: 值 → 显示名） |
| `image` | 图片选择（本地上传 / 媒体库，值存 `/uploads/...` 相对路径） |

**高级字段**：
- `group`: 字符串 → 设置页 Tab 分组（缺省"常规"，仅一组时无 Tab 栏）
- `show_if`: `{ "key": "...", "value": "..." }` → 等值联动显隐（依赖字段值匹配才显示，客户端即时生效）

### CSS 语义变量（theme.css 换肤）
前台已全部使用语义 token，覆盖这些变量即可整体换肤（`:root` 浅色 + `.dark` 深色）：

```css
:root {
  --bg: #ffffff;        /* 页面背景 */
  --fg: #464646;        /* 正文 */
  --muted: #8f8f8f;     /* 次要文字 */
  --card: #ffffff;      /* 卡片/侧边栏/顶栏背景 */
  --border: #f2f2f2;    /* 边框 */
  --accent: #4786d6;    /* 强调色（链接/按钮/激活态） */
  --accent-soft: rgba(71, 134, 214, 0.08); /* 强调色浅底 */
  --danger: #b4543f;    /* 危险/错误 */
  --title: #5f5f5f;     /* 标题 */
  --meta: #bbbbbb;      /* 时间/元信息 */
  --side: #565654;      /* 侧边栏次要文字 */
}
.dark { /* 深色模式同键覆盖 */ }
```

## 前台接线（设置值消费）

设置值存 `theme:{key}`，由前台布局 `getThemeValues()` 读取（值 = schema 默认值 + 已存值覆盖）。**前端组件需在布局/页面中主动读取并消费设置**——主题 CSS 只负责配色，设置驱动的文案/开关由前台代码读取：

```tsx
// src/app/(public)/layout.tsx 已示范的消费方式
const theme = await getThemeValues();
const showSidebar = theme.sidebar_enabled !== "0";
// 页脚：theme.footer_text 有值则显示
```

- 激活主题设置页：后台「主题与外观 → 当前主题 → 设置」（`/admin/appearance/{name}`）
- 非激活主题不可配置（共享 `theme:{key}` 命名空间，仅激活主题生效）
- 设置导入导出：主题设置页提供 JSON 备份（`{ format: "blogcms-theme-settings", theme, values }`）

## 主题机制要点

- 主题 CSS 只注入**前台**（`<style data-theme="name">` 在 (public) 布局 body 顶层），后台始终默认配色
- 切换主题 = 写 `active_theme`；激活主题必须存在（切换失败回退 `default`）
- 卸载主题：删除目录（卸载只删"该主题独有、其他已装主题不用"的设置键；正在使用的主题不可卸载）
- 主题不引入动态模板（RSC 无法动态加载 JSX），视觉切换靠 CSS 变量覆盖 + 前台组件读取设置

## 常用代码片段

### 最小可用主题
```json
{
  "name": "my-theme",
  "title": "我的主题",
  "version": "1.0.0",
  "description": "一句话说明",
  "author": "pafish",
  "settings": [
    { "key": "footer_text", "label": "页脚文案", "type": "text", "default": "" },
    { "key": "accent_color", "label": "强调色", "type": "color", "default": "#4786d6" }
  ]
}
```
```css
:root {
  --bg: #f7f2e9; --fg: #5b5346; --card: #fffdf7; --border: #e9dfcc;
  --accent: #b08968; --accent-soft: rgba(176, 137, 104, 0.12);
  --danger: #c05a4d; --title: #3e3628; --meta: #b3a794; --side: #6b6353;
}
```

### 带分组与联动的设置
```json
"settings": [
  { "key": "show_badge", "label": "显示徽章", "type": "switcher", "group": "内容", "default": "1" },
  { "key": "badge_text", "label": "徽章文字", "type": "text", "group": "内容", "show_if": { "key": "show_badge", "value": "1" } },
  { "key": "layout_style", "label": "版式", "type": "radio", "group": "布局", "default": "wide",
    "options": { "wide": "宽版", "narrow": "窄版" } }
]
```

## 发布到应用商店

与插件同套打包协议（唯一顶层目录 = 主题名、10MB、穿越防护、manifest 校验回滚）。构建：

```bash
node scripts/build-store.cjs
```
- 打包 `store-src/{name}/`（或现有 `themes/{name}/`）→ `public/store/{name}.zip`，生成 `themes.json`
- 远程商店源：后台「站点设置 → 应用商店地址」；商店更新为原子覆盖且**不触碰设置**
- 商店条目可带 `preview` 缩略图（如 `/store/my-theme.png`）

## 技能联动

- 视觉风格/排版/响应式决策优先 `ui-ux-pro-max` 或 `design-taste-frontend`，再把结论落到主题 CSS 变量与设置 schema
- 需要预览图等位图素材时用 `imagegen` 类技能生成 `preview` 图
- 最终由本 Skill 收口：确保改动只落在主题目录与 `theme:{key}` 设置，后台配色不受影响

## 参考文档

- pafish 主题开发完整文档：`./theme.md`
- 可运行主题示例：`./assets/demo-theme/`
- 插件开发（含事件钩子与注入管线）：`../pafish-plugin-dev-skill/SKILL.md`
