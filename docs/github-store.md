# 把应用商店发布到 GitHub Pages

商店源协议：源 = 一个基础 URL，其下提供 `themes.json` / `plugins.json` 与 zip 文件。本方案用 GitHub 仓库的 `gh-pages` 分支 + GitHub Pages 托管，全站服务端 fetch 读取（无 CORS 问题）。

架构：`public/store/`（构建产物） → 独立发布仓库 `.store-publish/`（gh-pages 分支） → `https://<owner>.github.io/<repo>/`

发布后的仓库目录结构（脚本自动组装）：

```
gh-pages 分支
├── themes.json     # {base}/themes.json
├── plugins.json    # {base}/plugins.json
└── store/          # zip 保持 catalog 中的相对路径（zip 字段 = /store/xxx.zip）
    ├── paper.zip   # {base}/store/paper.zip
    └── ...
```

## 内置官方商店（无需配置）

pafish 已将 `https://shuyu0131.github.io/pafish-store/` **内置为默认商店源**：

- 站点设置中「应用商店地址」**留空**即使用官方商店，无需任何配置
- 远程不可达（断网/目录损坏）时自动回退本地内置商店（`public/store`），商店页不会白屏，并显示回退提示
- 发布更新后无需改动任何配置：脚本推送 → Pages 约 10 分钟生效 → 商店页可见新版本
- 想用自己的商店：在「应用商店地址」填自定义远程源即可覆盖（优先级最高）

## 一次性配置（约 5 分钟，网页操作）

### 1. 创建 GitHub 仓库

1. 打开 https://github.com/new
2. 仓库名填 `pafish-store`（可改，与后面脚本 `PUBLISH_REPO` 对应）
3. 可见性任选：**公开** = 任何人都能装你的应用；**私有** = 仅你自己（需配合站点设置的"商店访问令牌"，见下方"私有仓库"节）
4. 不要勾选 "Add a README / .gitignore / license"（保持空仓库即可）
5. 点 Create repository

### 2. 配置推送认证（二选一，推荐 A）

**A. Git Credential Manager（Windows 推荐，已配置好）**

首次 push 时会自动弹出 GitHub 网页登录窗口，登录一次即可，之后无需管理。

**B. Personal Access Token（PAT）**

1. 打开 https://github.com/settings/tokens → Generate new token (classic)
2. 勾选 `repo` 权限，生成后复制 `ghp_...`
3. 每次发布前执行：`export GITHUB_TOKEN=ghp_你的token`（脚本自动用 `x-access-token` 方式认证）

### 3. 首次发布

```bash
cd C:\Users\yt\ZCodeProject\pafish
export PUBLISH_OWNER=你的GitHub用户名     # 如 shuyu0131（注意：不是 git 提交身份 shuyu0301）
export PUBLISH_REPO=pafish-store          # 与第 1 步仓库名一致
bash scripts/publish-store.sh
```

脚本自动完成：构建产物 → 组装到 `.store-publish/`（独立 git 仓库，gh-pages 分支）→ 推送。

### 4. 启用 GitHub Pages

1. 打开仓库 → **Settings → Pages**
2. Build and deployment → Source 选 **Deploy from a branch**
3. Branch 选 **`gh-pages`**、目录选 **`/ (root)`** → Save
4. 等 1~2 分钟，页面顶部显示 "Your site is live at `https://<owner>.github.io/pafish-store/`"

### 5. 站点接入

后台 → 站点设置 → **应用商店地址** 填：

```
https://<owner>.github.io/pafish-store/
```

保存后打开后台 → 应用商店，应显示"远程源"目录（4 个应用：paper、demo-nord、hello-pafish、demo-hooks），可直接安装/更新。

## 日常更新应用

修改 `store-src/`、`themes/`、`plugins/` 后重新发布：

```bash
bash scripts/publish-store.sh
```

- 幂等，可反复执行；zip 文件名不变（包名.zip），Pages CDN 约 **10 分钟**后全量生效
- 版本号在 manifest 里递增，站点商店页的"更新"按版本比较提示
- 目录文件（themes.json/plugins.json）会随仓库内容更新

## 私有仓库（定向分发）

私有仓库的 Pages 同样可公开访问（Pages 域名下的内容不要求仓库可读），**仅用于限制"谁能下载"时意义有限**。更实际的做法：

- 仓库保持**公开**，Pages 域名人人可访问（源码型应用无法真正防下载，付费靠 License Key 应用层激活）
- 私有仓库 + 站点"商店访问令牌"（Bearer）组合适合**限时内测 / 定向分发**场景：此时建议用 raw 直链而非 Pages（raw.githubusercontent.com 私有仓库支持 `Authorization: Bearer <PAT>`，与我们的令牌机制完全兼容）：

```
站点设置 → 商店访问令牌：ghp_xxx
商店地址：https://raw.githubusercontent.com/<owner>/<repo>/gh-pages/
```

> 注意：令牌保存在服务器并随请求发送，仅本机自用场景使用；不要把令牌提交到任何仓库。

## 排错

| 现象 | 原因与处理 |
| :--- | :--- |
| `remote: Repository not found` | 仓库名/用户名写错，或仓库还没创建 |
| push 弹窗后仍失败 | 仓库是私有的但账号无权限；或未走 GCM 登录 |
| Pages 显示 404 | 分支名不是 `gh-pages`、目录不是 `/ (root)`，或首次推送后未等待 1~2 分钟 |
| 商店页"目录获取失败" | 检查商店地址是否以 `/` 结尾、地址域名拼写；用浏览器打开 `{地址}/themes.json` 验证 |
| 商店页"HTTP 401/403" | 源要求鉴权而站点令牌未填/填错（私有 raw 源场景） |
