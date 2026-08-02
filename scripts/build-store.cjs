// 构建内置应用商店源：把 store-src/ 与现有 themes/demo-nord、plugins/demo-hooks
// 打包为 public/store/*.zip，并生成 themes.json / plugins.json（幂等，可重复执行）。
// 用法：node scripts/build-store.cjs
// zip 顶层目录 = 包名（validateZip 要求唯一顶层目录 = 名称），统一用 adm-zip 保证跨平台路径。

const fs = require("node:fs");
const path = require("node:path");
const AdmZip = require("adm-zip");

const root = path.join(__dirname, "..");
const publicStore = path.join(root, "public", "store");
const storeSrc = path.join(root, "store-src");

// [kind, 源目录, 包名, 存放目标]
const PACKS = [
  ["theme", path.join(storeSrc, "paper"), "paper", "zip"],
  ["theme", path.join(root, "themes", "demo-nord"), "demo-nord", "zip"],
  ["plugin", path.join(storeSrc, "hello-pafish"), "hello-pafish", "zip"],
  ["plugin", path.join(storeSrc, "binfen-storage"), "binfen-storage", "zip"],
  ["plugin", path.join(root, "plugins", "demo-hooks"), "demo-hooks", "zip"],
];

const MANIFEST_FILE = { theme: "theme.json", plugin: "plugin.json" };

function readManifest(dir, kind) {
  const raw = fs.readFileSync(path.join(dir, MANIFEST_FILE[kind]), "utf8");
  const m = JSON.parse(raw);
  if (!m || m.name === undefined || m.title === undefined || m.version === undefined) {
    throw new Error(`manifest 缺少字段：${path.join(dir, MANIFEST_FILE[kind])}`);
  }
  return m;
}

// 幂等：清理旧产物
fs.mkdirSync(publicStore, { recursive: true });
for (const f of fs.readdirSync(publicStore)) {
  if (f.endsWith(".zip") || f.endsWith(".json")) {
    fs.unlinkSync(path.join(publicStore, f));
  }
}

const catalogs = { theme: [], plugin: [] };

for (const [kind, dir, name, out] of PACKS) {
  const m = readManifest(dir, kind);
  if (m.name !== name) throw new Error(`manifest name(${m.name}) 与目录名(${name})不一致`);

  const zip = new AdmZip();
  zip.addLocalFolder(dir, name); // 顶层目录 = 包名
  const zipPath = path.join(publicStore, `${name}.zip`);
  zip.writeZip(zipPath);

  const entry = {
    name,
    title: m.title,
    version: m.version,
    description: m.description ?? "",
    author: m.author ?? "",
    zip: `/store/${name}.zip`,
    // preview: 可放 /store/{name}.png 作为缩略图（暂无资源则不输出）
  };
  catalogs[kind].push(entry);
  console.log(`[ok] ${kind} ${name} v${m.version} → ${path.relative(root, zipPath)}`);
}

for (const kind of ["theme", "plugin"]) {
  const jsonPath = path.join(publicStore, `${kind}s.json`);
  // 协议：顶层为条目数组
  fs.writeFileSync(jsonPath, JSON.stringify(catalogs[kind], null, 2) + "\n");
  console.log(`[ok] ${jsonPath}（${catalogs[kind].length} 条）`);
}

console.log("内置商店构建完成。");
