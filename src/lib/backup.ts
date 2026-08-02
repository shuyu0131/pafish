import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const execFileP = promisify(execFile);

// 备份/恢复使用 root 连接（应用连接账号无 DUMP 权限）
const DB_HOST = process.env.DB_HOST ?? "127.0.0.1";
const DB_PORT = process.env.DB_PORT ?? "3307";
const DB_NAME = process.env.DB_NAME ?? "pafish";
const DB_ROOT_USER = process.env.DB_ROOT_USER ?? "root";
const DB_ROOT_PASSWORD = process.env.DB_ROOT_PASSWORD ?? "pafish_root_2026";

// 备份文件目录：项目根/backups（不随代码入库，可整目录迁移）
export const BACKUP_DIR = path.join(process.cwd(), "backups");

function mysqlBin(name: "mysqldump" | "mysql"): string {
  const envKey = name === "mysqldump" ? "MYSQLDUMP_PATH" : "MYSQL_PATH";
  if (process.env[envKey]) return process.env[envKey]!;
  // Windows 常见安装位置兜底
  const candidate = `C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\${name}.exe`;
  if (fs.existsSync(candidate)) return candidate;
  return name; // 交给 PATH
}

function connArgs(): string[] {
  return [
    `--host=${DB_HOST}`,
    `--port=${DB_PORT}`,
    `--user=${DB_ROOT_USER}`,
    `--default-character-set=utf8mb4`,
  ];
}

function stamp(): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// 校验文件名：仅允许 backups 目录内 backup-*.sql / upload-*.sql，防目录穿越
export function safeBackupPath(file: string): string | null {
  const base = path.basename(file);
  if (base !== file) return null;
  if (!/^(backup|upload)-.*\.sql$/.test(base)) return null;
  return path.join(BACKUP_DIR, base);
}

export function listBackups(): { file: string; size: number; mtime: Date }[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /^(backup|upload)-.*\.sql$/.test(f))
    .map((f) => {
      const s = fs.statSync(path.join(BACKUP_DIR, f));
      return { file: f, size: s.size, mtime: s.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

/** 执行 mysqldump 生成备份文件，返回文件名 */
export async function createBackupFile(): Promise<{ file: string; size: number }> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = `backup-${stamp()}.sql`;
  const args = [
    ...connArgs(),
    "--single-transaction",
    "--routines",
    "--triggers",
    "--result-file=" + path.join(BACKUP_DIR, file),
    DB_NAME,
  ];
  await execFileP(mysqlBin("mysqldump"), args, {
    env: { ...process.env, MYSQL_PWD: DB_ROOT_PASSWORD },
    maxBuffer: 512 * 1024 * 1024,
    windowsHide: true,
  });
  const size = fs.statSync(path.join(BACKUP_DIR, file)).size;
  return { file, size };
}

/** 将 SQL 文件恢复到数据库（恢复前务必先调用 createBackupFile 留底） */
export async function restoreBackupFile(sqlFile: string): Promise<void> {
  const target = safeBackupPath(sqlFile);
  if (!target) throw new Error("非法的备份文件名");
  if (!fs.existsSync(target)) throw new Error("备份文件不存在");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(mysqlBin("mysql"), [...connArgs(), DB_NAME], {
      env: { ...process.env, MYSQL_PWD: DB_ROOT_PASSWORD },
      stdio: ["pipe", "ignore", "pipe"],
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    fs.createReadStream(target).pipe(child.stdin);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`恢复失败（退出码 ${code}）${stderr ? "：" + stderr.slice(0, 200) : ""}`));
    });
  });
}

/** 写入上传的 SQL 文件到备份目录，返回文件名 */
export async function saveUploadedSql(buffer: Buffer): Promise<string> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = `upload-${stamp()}.sql`;
  fs.writeFileSync(path.join(BACKUP_DIR, file), buffer);
  return file;
}
