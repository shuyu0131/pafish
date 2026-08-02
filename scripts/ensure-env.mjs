#!/usr/bin/env node
// 幂等生成 .env：已存在则不动；不存在则复制 .env.example 并把 AUTH_SECRET 替换为随机值
// 用法：node scripts/ensure-env.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const examplePath = join(root, ".env.example");

if (existsSync(envPath)) {
  console.log("✓ .env 已存在，跳过生成（如需更换 AUTH_SECRET 请手动修改）");
  process.exit(0);
}

if (!existsSync(examplePath)) {
  console.error("✗ 缺少 .env.example，无法生成 .env");
  process.exit(1);
}

let content = readFileSync(examplePath, "utf8");
const secret = randomBytes(32).toString("hex");
content = content.replace(
  /^AUTH_SECRET=.*$/m,
  `AUTH_SECRET="${secret}"`
);
writeFileSync(envPath, content, "utf8");
console.log("✓ 已生成 .env（AUTH_SECRET 为随机值，请按需修改 SITE_URL 与 DATABASE_URL）");
