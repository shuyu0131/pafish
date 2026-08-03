# pafish 博客 CMS —— 完全容器化（多阶段构建）
# 构建：docker compose build（或 docker build -t pafish .）
# 运行：docker compose up -d

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- 依赖 ----
FROM base AS deps
# 国内网络可传 registry 镜像：docker build --build-arg npm_config_registry=https://registry.npmmirror.com
ARG npm_config_registry
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- 构建 ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 生成 Prisma Client（自定义输出 src/generated/prisma，已被 .gitignore 排除，必须在构建时生成）
RUN npx prisma generate
# 构建期 next build 会加载全部路由模块并实例化 Prisma adapter（懒连接，仅解析 URL 不建连），
# 故需占位 DATABASE_URL；运行时由 compose 注入真实值（见 docker-compose.yml app.environment）
ENV DATABASE_URL="mysql://pafish:pafish_pass@mysql:3306/pafish"
RUN npm run build
# seed 与索引修复脚本打包为单文件（容器内 node 直接运行，无需 tsx/dotenv 运行时）
# --define:import.meta.url：prisma-client 生成代码用 fileURLToPath(import.meta.url) 取 __dirname，
#   cjs bundle 下 import.meta.url 为空，注入 bundle 文件自身的 file:// URL（dirname=/app）
RUN npx esbuild prisma/seed.ts --bundle --platform=node --target=node22 --format=cjs --define:import.meta.url='"file:///app/main.cjs"' --outfile=seed.cjs \
 && npx esbuild scripts/fix-ft-index.ts --bundle --platform=node --target=node22 --format=cjs --define:import.meta.url='"file:///app/main.cjs"' --outfile=fix-ft-index.cjs

# ---- 运行 ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
# 后台「数据备份/恢复」功能需要 mysqldump / mysql 二进制
RUN apk add --no-cache mariadb-client

# Next.js standalone 产物（server.js + 精简 node_modules）
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma CLI（migrate deploy 用，standalone 不追踪 CLI）+ schema 引擎二进制 + 客户端运行时
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/mariadb ./node_modules/mariadb
COPY --from=builder /app/node_modules/denque ./node_modules/denque
COPY --from=builder /app/node_modules/iconv-lite ./node_modules/iconv-lite
COPY --from=builder /app/node_modules/lru-cache ./node_modules/lru-cache
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
# prisma CLI 运行依赖（standalone 精简 node_modules 不含，按依赖闭包补齐）
COPY --from=builder /app/node_modules/@electric-sql/pglite ./node_modules/@electric-sql/pglite
COPY --from=builder /app/node_modules/@electric-sql/pglite-socket ./node_modules/@electric-sql/pglite-socket
COPY --from=builder /app/node_modules/@electric-sql/pglite-tools ./node_modules/@electric-sql/pglite-tools
COPY --from=builder /app/node_modules/@radix-ui/primitive ./node_modules/@radix-ui/primitive
COPY --from=builder /app/node_modules/@radix-ui/react-compose-refs ./node_modules/@radix-ui/react-compose-refs
COPY --from=builder /app/node_modules/@radix-ui/react-primitive ./node_modules/@radix-ui/react-primitive
COPY --from=builder /app/node_modules/@radix-ui/react-slot ./node_modules/@radix-ui/react-slot
COPY --from=builder /app/node_modules/@radix-ui/react-toggle ./node_modules/@radix-ui/react-toggle
COPY --from=builder /app/node_modules/@radix-ui/react-use-controllable-state ./node_modules/@radix-ui/react-use-controllable-state
COPY --from=builder /app/node_modules/@radix-ui/react-use-effect-event ./node_modules/@radix-ui/react-use-effect-event
COPY --from=builder /app/node_modules/@radix-ui/react-use-layout-effect ./node_modules/@radix-ui/react-use-layout-effect
COPY --from=builder /app/node_modules/@standard-schema/spec ./node_modules/@standard-schema/spec
COPY --from=builder /app/node_modules/@types/d3-array ./node_modules/@types/d3-array
COPY --from=builder /app/node_modules/@types/d3-color ./node_modules/@types/d3-color
COPY --from=builder /app/node_modules/@types/d3-delaunay ./node_modules/@types/d3-delaunay
COPY --from=builder /app/node_modules/@types/d3-format ./node_modules/@types/d3-format
COPY --from=builder /app/node_modules/@types/d3-geo ./node_modules/@types/d3-geo
COPY --from=builder /app/node_modules/@types/d3-interpolate ./node_modules/@types/d3-interpolate
COPY --from=builder /app/node_modules/@types/d3-path ./node_modules/@types/d3-path
COPY --from=builder /app/node_modules/@types/d3-scale ./node_modules/@types/d3-scale
COPY --from=builder /app/node_modules/@types/d3-shape ./node_modules/@types/d3-shape
COPY --from=builder /app/node_modules/@types/d3-time ./node_modules/@types/d3-time
COPY --from=builder /app/node_modules/@types/d3-time-format ./node_modules/@types/d3-time-format
COPY --from=builder /app/node_modules/@types/geojson ./node_modules/@types/geojson
COPY --from=builder /app/node_modules/@types/lodash ./node_modules/@types/lodash
COPY --from=builder /app/node_modules/@types/react ./node_modules/@types/react
COPY --from=builder /app/node_modules/@visx/curve ./node_modules/@visx/curve
COPY --from=builder /app/node_modules/@visx/event ./node_modules/@visx/event
COPY --from=builder /app/node_modules/@visx/grid ./node_modules/@visx/grid
COPY --from=builder /app/node_modules/@visx/group ./node_modules/@visx/group
COPY --from=builder /app/node_modules/@visx/point ./node_modules/@visx/point
COPY --from=builder /app/node_modules/@visx/responsive ./node_modules/@visx/responsive
COPY --from=builder /app/node_modules/@visx/scale ./node_modules/@visx/scale
COPY --from=builder /app/node_modules/@visx/shape ./node_modules/@visx/shape
COPY --from=builder /app/node_modules/@visx/vendor ./node_modules/@visx/vendor
COPY --from=builder /app/node_modules/ajv ./node_modules/ajv
COPY --from=builder /app/node_modules/aws-ssl-profiles ./node_modules/aws-ssl-profiles
COPY --from=builder /app/node_modules/better-result ./node_modules/better-result
COPY --from=builder /app/node_modules/c12 ./node_modules/c12
COPY --from=builder /app/node_modules/chokidar ./node_modules/chokidar
COPY --from=builder /app/node_modules/classnames ./node_modules/classnames
COPY --from=builder /app/node_modules/confbox ./node_modules/confbox
COPY --from=builder /app/node_modules/cross-spawn ./node_modules/cross-spawn
COPY --from=builder /app/node_modules/csstype ./node_modules/csstype
COPY --from=builder /app/node_modules/d3-array ./node_modules/d3-array
COPY --from=builder /app/node_modules/d3-color ./node_modules/d3-color
COPY --from=builder /app/node_modules/d3-delaunay ./node_modules/d3-delaunay
COPY --from=builder /app/node_modules/d3-format ./node_modules/d3-format
COPY --from=builder /app/node_modules/d3-geo ./node_modules/d3-geo
COPY --from=builder /app/node_modules/d3-interpolate ./node_modules/d3-interpolate
COPY --from=builder /app/node_modules/d3-path ./node_modules/d3-path
COPY --from=builder /app/node_modules/d3-scale ./node_modules/d3-scale
COPY --from=builder /app/node_modules/d3-shape ./node_modules/d3-shape
COPY --from=builder /app/node_modules/d3-time ./node_modules/d3-time
COPY --from=builder /app/node_modules/d3-time-format ./node_modules/d3-time-format
COPY --from=builder /app/node_modules/deepmerge-ts ./node_modules/deepmerge-ts
COPY --from=builder /app/node_modules/defu ./node_modules/defu
COPY --from=builder /app/node_modules/delaunator ./node_modules/delaunator
COPY --from=builder /app/node_modules/denque ./node_modules/denque
COPY --from=builder /app/node_modules/destr ./node_modules/destr
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder /app/node_modules/effect ./node_modules/effect
COPY --from=builder /app/node_modules/elkjs ./node_modules/elkjs
COPY --from=builder /app/node_modules/empathic ./node_modules/empathic
COPY --from=builder /app/node_modules/env-paths ./node_modules/env-paths
COPY --from=builder /app/node_modules/exsolve ./node_modules/exsolve
COPY --from=builder /app/node_modules/fast-check ./node_modules/fast-check
COPY --from=builder /app/node_modules/fast-decode-uri-component ./node_modules/fast-decode-uri-component
COPY --from=builder /app/node_modules/fast-deep-equal ./node_modules/fast-deep-equal
COPY --from=builder /app/node_modules/fast-json-stable-stringify ./node_modules/fast-json-stable-stringify
COPY --from=builder /app/node_modules/fast-querystring ./node_modules/fast-querystring
COPY --from=builder /app/node_modules/find-my-way ./node_modules/find-my-way
COPY --from=builder /app/node_modules/foreground-child ./node_modules/foreground-child
COPY --from=builder /app/node_modules/generate-function ./node_modules/generate-function
COPY --from=builder /app/node_modules/get-port-please ./node_modules/get-port-please
COPY --from=builder /app/node_modules/giget ./node_modules/giget
COPY --from=builder /app/node_modules/graceful-fs ./node_modules/graceful-fs
COPY --from=builder /app/node_modules/grammex ./node_modules/grammex
COPY --from=builder /app/node_modules/graphmatch ./node_modules/graphmatch
COPY --from=builder /app/node_modules/iconv-lite ./node_modules/iconv-lite
COPY --from=builder /app/node_modules/internmap ./node_modules/internmap
COPY --from=builder /app/node_modules/is-property ./node_modules/is-property
COPY --from=builder /app/node_modules/isexe ./node_modules/isexe
COPY --from=builder /app/node_modules/jiti ./node_modules/jiti
COPY --from=builder /app/node_modules/json-schema-traverse ./node_modules/json-schema-traverse
COPY --from=builder /app/node_modules/lodash ./node_modules/lodash
COPY --from=builder /app/node_modules/long ./node_modules/long
COPY --from=builder /app/node_modules/lru.min ./node_modules/lru.min
COPY --from=builder /app/node_modules/mysql2 ./node_modules/mysql2
COPY --from=builder /app/node_modules/named-placeholders ./node_modules/named-placeholders
COPY --from=builder /app/node_modules/ohash ./node_modules/ohash
COPY --from=builder /app/node_modules/path-key ./node_modules/path-key
COPY --from=builder /app/node_modules/pathe ./node_modules/pathe
COPY --from=builder /app/node_modules/perfect-debounce ./node_modules/perfect-debounce
COPY --from=builder /app/node_modules/pkg-types ./node_modules/pkg-types
COPY --from=builder /app/node_modules/postgres ./node_modules/postgres
COPY --from=builder /app/node_modules/proper-lockfile ./node_modules/proper-lockfile
COPY --from=builder /app/node_modules/punycode ./node_modules/punycode
COPY --from=builder /app/node_modules/pure-rand ./node_modules/pure-rand
COPY --from=builder /app/node_modules/rc9 ./node_modules/rc9
COPY --from=builder /app/node_modules/readdirp ./node_modules/readdirp
COPY --from=builder /app/node_modules/remeda ./node_modules/remeda
COPY --from=builder /app/node_modules/ret ./node_modules/ret
COPY --from=builder /app/node_modules/retry ./node_modules/retry
COPY --from=builder /app/node_modules/robust-predicates ./node_modules/robust-predicates
COPY --from=builder /app/node_modules/safe-regex2 ./node_modules/safe-regex2
COPY --from=builder /app/node_modules/safer-buffer ./node_modules/safer-buffer
COPY --from=builder /app/node_modules/seq-queue ./node_modules/seq-queue
COPY --from=builder /app/node_modules/shebang-command ./node_modules/shebang-command
COPY --from=builder /app/node_modules/shebang-regex ./node_modules/shebang-regex
COPY --from=builder /app/node_modules/signal-exit ./node_modules/signal-exit
COPY --from=builder /app/node_modules/sqlstring ./node_modules/sqlstring
COPY --from=builder /app/node_modules/std-env ./node_modules/std-env
COPY --from=builder /app/node_modules/uri-js ./node_modules/uri-js
COPY --from=builder /app/node_modules/valibot ./node_modules/valibot
COPY --from=builder /app/node_modules/which ./node_modules/which
COPY --from=builder /app/node_modules/zeptomatch ./node_modules/zeptomatch

# sharp 及其依赖（上传图片压缩原生二进制；standalone 已自动追踪携带，此处 COPY 为兜底覆盖，源不存在时跳过）
COPY --from=builder /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder /app/node_modules/@img ./node_modules/@img
COPY --from=builder /app/node_modules/detect-libc ./node_modules/detect-libc
COPY --from=builder /app/node_modules/semver ./node_modules/semver

# 数据库迁移文件、脚本与内置主题/插件种子（空卷首启恢复用）
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/seed.cjs ./seed.cjs
COPY --from=builder /app/fix-ft-index.cjs ./fix-ft-index.cjs
COPY --from=builder /app/themes ./themes-seed
COPY --from=builder /app/plugins ./plugins-seed
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
