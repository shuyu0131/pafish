import { DatabaseBackup } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { canAdmin } from "@/lib/constants";
import { redirect } from "next/navigation";
import { listBackups } from "@/lib/backup";
import { BackupManager } from "./backup-manager";

export const metadata = { title: "数据备份" };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default async function BackupPage() {
  const session = await requireSession();
  if (!canAdmin(session.role)) redirect("/admin");

  const backups = listBackups();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">数据备份</h1>
        <p className="mt-1 text-sm text-muted">
          备份内容为完整数据库（文章、页面、分类、评论、设置等），文件保存在服务器 backups 目录
        </p>
      </div>

      <BackupManager
        backups={backups.map((b) => ({
          file: b.file,
          sizeLabel: formatSize(b.size),
          mtimeLabel: b.mtime.toLocaleString("zh-CN", { hour12: false }),
        }))}
      />

      <div className="card p-5 text-sm leading-relaxed text-muted">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <DatabaseBackup size={15} />
          使用说明
        </h2>
        <ul className="list-inside list-disc space-y-1">
          <li>点击「立即备份」生成当前数据库快照，建议定期手动备份（部署后可用计划任务自动化）</li>
          <li>恢复前系统会自动先创建一份安全备份，防止误操作无法回退</li>
          <li>恢复会覆盖当前全部数据，需输入备份文件名二次确认</li>
          <li>上传的 .sql 文件会保存为 upload-* 并在列表展示，恢复完成后请手动清理</li>
          <li>备份文件包含数据库凭据之外的全部数据，注意保管，勿公开目录</li>
        </ul>
      </div>
    </div>
  );
}
