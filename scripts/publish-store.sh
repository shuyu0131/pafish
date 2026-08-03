#!/usr/bin/env bash
# 发布应用商店到 GitHub Pages（gh-pages 分支部署）
#
# 前置条件（一次性，见 docs/github-store.md）：
#   1. 已在 GitHub 网页创建仓库（如 pafish-store），无需初始化任何文件
#   2. 已配置推送认证（推荐 Git Credential Manager，首次 push 弹窗网页登录；
#      或用 export GITHUB_TOKEN=ghp_xxx 使用 PAT）
#   3. 首次发布后，在仓库 Settings → Pages 选择 Deploy from a branch: gh-pages / (root)
#
# 用法：
#   export PUBLISH_OWNER=你的GitHub用户名
#   export PUBLISH_REPO=pafish-store
#   bash scripts/publish-store.sh
#   # 只构建不推送（本地检查产物）：
#   SKIP_PUSH=1 bash scripts/publish-store.sh
#
# 更新应用流程：修改 store-src/ 或 themes/、plugins/ 后重跑本脚本即可；
# Pages 约 10 分钟生效，之后在后台商店页即可检查到更新。

set -euo pipefail
cd "$(dirname "$0")/.."

OWNER="${PUBLISH_OWNER:-}"
REPO="${PUBLISH_REPO:-}"
BRANCH="${PUBLISH_BRANCH:-gh-pages}"
DIR=".store-publish"

if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
  echo "错误：请设置 PUBLISH_OWNER（GitHub 用户名）与 PUBLISH_REPO（仓库名）"
  echo "示例：PUBLISH_OWNER=shuyu0131 PUBLISH_REPO=pafish-store bash scripts/publish-store.sh"
  exit 1
fi

echo "[1/3] 构建商店产物（scripts/build-store.cjs）…"
node scripts/build-store.cjs

echo "[2/3] 组装发布目录（$DIR，仅商店产物，与源码隔离）…"
rm -rf "$DIR"
mkdir -p "$DIR/store"
cp public/store/themes.json public/store/plugins.json "$DIR/"
# zip 保持 catalog 里的相对路径结构（zip 字段 = /store/xxx.zip，内置源直读 public/store/，
# 远程源拼 {base}/store/xxx.zip），故放入 store/ 子目录
cp public/store/*.zip "$DIR/store/"
ls -la "$DIR" "$DIR/store"

if [ ! -d "$DIR/.git" ]; then
  echo "[3/3] 初始化仓库并提交（orphan 分支 $BRANCH）…"
  git -C "$DIR" init -q -b "$BRANCH"
  git -C "$DIR" add -A
  git -C "$DIR" -c user.name="pafish-store" -c user.email="pafish-store@local" \
    commit -q -m "store: $(date '+%Y-%m-%d %H:%M')"
else
  echo "[3/3] 提交增量更新…"
  git -C "$DIR" add -A
  git -C "$DIR" -c user.name="pafish-store" -c user.email="pafish-store@local" \
    commit -q -m "store: $(date '+%Y-%m-%d %H:%M')" || echo "（无变更）"
fi

if [ "${SKIP_PUSH:-0}" = "1" ]; then
  echo "SKIP_PUSH=1：跳过推送。产物已就绪于 $DIR/"
  exit 0
fi

echo "[4/4] 推送到 https://github.com/$OWNER/$REPO ($BRANCH) …"
git -C "$DIR" remote remove origin 2>/dev/null || true
if [ -n "${GITHUB_TOKEN:-}" ]; then
  git -C "$DIR" remote add origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${OWNER}/${REPO}.git"
else
  git -C "$DIR" remote add origin "https://github.com/${OWNER}/${REPO}.git"
fi
git -C "$DIR" push -u origin "$BRANCH" --force

echo ""
echo "✅ 发布完成：https://github.com/$OWNER/$REPO/tree/$BRANCH"
echo "   站点设置 → 应用商店地址填：https://$OWNER.github.io/$REPO/"
echo "   （首次发布后记得在仓库 Settings → Pages 启用 Deploy from branch: $BRANCH）"
