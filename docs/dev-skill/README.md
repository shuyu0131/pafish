# 🐟 pafish 应用开发 Agent Skill

协助 AI 开发 pafish 博客 CMS 的应用（插件、主题）。当用户想要创建新应用、修改现有应用、询问 pafish 应用开发规范时调用的 Agent Skill。

pafish 是 Next.js 16 (App Router) + React 19 + Tailwind v4 + TypeScript 全栈博客系统，插件/主题以**文件目录即应用**的方式落地（对标 emlog 的 `content/plugins` / `content/templates`）。

## Agent Skill

本项目包含以下两个核心 Skill：

| Skill | 说明 | 触发场景 |
| :--- | :--- | :--- |
| `pafish-plugin-dev` | pafish 插件开发助手 | 创建/修改/迭代插件、询问插件 API 与事件钩子 |
| `pafish-theme-dev` | pafish 主题开发助手 | 创建/修改/迭代主题、设置面板、CSS 变量换肤 |

## 使用

### ZCode / Codex / Claude Code

将两个 Skill 目录复制到技能目录（ZCode 为 `~/.agents/skills/`，其他编辑器按其约定）：

```
.agents/
└── skills/
    ├── pafish-plugin-dev-skill/
    └── pafish-theme-dev-skill/
```

### Trae / Cursor 编辑器

```
.trae/skills/   （或 .cursor/skills/）
├── pafish-plugin-dev-skill/
└── pafish-theme-dev-skill/
```

### 触发

编辑器会根据提示词自动加载相关 Skill，如：

```
开发一个 pafish 插件，实现如下功能：
1. 文章发布后自动生成摘要并写入插件数据
2. xxxxxxx
3. xxxxxxx
```

```
把现有主题改成暖白纸感风格，并在后台加两个可配置项
```

## 文档结构

| 文件 | 内容 |
| :--- | :--- |
| `pafish-plugin-dev-skill/SKILL.md` | 插件开发速查（自动加载） |
| `pafish-plugin-dev-skill/plugin.md` | 插件开发完整文档 |
| `pafish-plugin-dev-skill/assets/demo-plugin/` | 可运行插件示例（plugin.json + index.mjs） |
| `pafish-theme-dev-skill/SKILL.md` | 主题开发速查（自动加载） |
| `pafish-theme-dev-skill/theme.md` | 主题开发完整文档 |
| `pafish-theme-dev-skill/assets/demo-theme/` | 可运行主题示例（theme.json + theme.css） |

## 核心概念速览

- **插件**：`plugins/{name}/`，`plugin.json`（manifest + 设置 schema）+ `index.mjs`（原生 ESM：钩子注册 / 生命周期 / 前台注入）
- **主题**：`themes/{name}/`，`theme.json`（manifest + 设置 schema）+ `theme.css`（CSS 语义变量覆盖，前台换肤）
- **事件钩子**：`ctx.on("after_create_post", fn)` 等 12 个点位，只在 node runtime（server action / route handler）触发
- **前台注入管线**：插件 `renderInjection(target, ctx)` 产出 HTML → 写库 → RSC 输出（head/footer/sidebar）
- **设置 schema**：插件 4 类型（text/textarea/checkbox/select），主题 8 类型（+ color/switcher/radio/image + group 分组 + show_if 联动）
- **应用商店**：`scripts/build-store.cjs` 打包 `store-src/` → `public/store/`，安装/更新走统一 zip 安全校验
