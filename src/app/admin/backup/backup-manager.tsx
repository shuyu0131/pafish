"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveRestore,
  DatabaseBackup,
  Download,
  HardDriveDownload,
  Trash2,
  Upload,
} from "lucide-react";
import { createBackup, deleteBackup, restoreBackup } from "../actions";

interface BackupRow {
  file: string;
  sizeLabel: string;
  mtimeLabel: string;
}

export function BackupManager({ backups }: { backups: BackupRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function notify(ok: boolean, text: string) {
    setMsg({ ok, text });
  }

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await fn();
        notify(true, "操作成功");
        router.refresh();
      } catch (e) {
        notify(false, e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  async function onUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/backup/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "上传失败");
      notify(true, `已上传，可在下方列表中选择恢复：${data.file}`);
      router.refresh();
    } catch (e) {
      notify(false, e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center gap-3 p-5">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={() => run(() => createBackup())}
        >
          <HardDriveDownload size={15} />
          {pending ? "备份中…" : "立即备份"}
        </button>
        <label className="btn btn-outline cursor-pointer">
          <Upload size={15} />
          {uploading ? "上传中…" : "上传 SQL 文件"}
          <input
            ref={fileRef}
            type="file"
            accept=".sql"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
            }}
          />
        </label>
        <p className="text-xs text-muted">
          共 {backups.length} 份备份，按时间倒序
        </p>
      </div>

      {msg && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            msg.ok ? "bg-accent-soft text-foreground" : "bg-danger/10 text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="card divide-y divide-border overflow-hidden">
        {backups.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted">
            <DatabaseBackup size={32} strokeWidth={1.5} />
            <p className="text-sm">还没有备份</p>
          </div>
        )}
        {backups.map((b) => (
          <div key={b.file} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm">{b.file}</p>
              <p className="mt-0.5 text-xs text-muted">
                {b.mtimeLabel} · {b.sizeLabel}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <a
                href={`/api/backup/download?file=${encodeURIComponent(b.file)}`}
                className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
                title="下载"
              >
                <Download size={14} />
              </a>
              <button
                type="button"
                className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
                onClick={() => {
                  setRestoring(restoring === b.file ? null : b.file);
                  setConfirmText("");
                }}
              >
                <ArchiveRestore size={14} />
                恢复
              </button>
              <button
                type="button"
                className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
                title="删除备份"
                disabled={b.file.startsWith("upload-")}
                onClick={() =>
                  run(() =>
                    deleteBackup(b.file).then(() =>
                      notify(true, `已删除 ${b.file}`)
                    )
                  )
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
            {restoring === b.file && (
              <div className="w-full rounded-lg bg-accent-soft p-4">
                <p className="mb-2 text-xs text-muted">
                  恢复将覆盖当前全部数据。系统会先自动创建一份安全备份。请输入备份文件名以确认：
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="input !w-auto flex-1 font-mono !text-xs"
                    placeholder={b.file}
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-danger !text-xs"
                    disabled={pending || confirmText.trim() !== b.file}
                    onClick={() =>
                      run(() =>
                        restoreBackup({ file: b.file, confirm: confirmText.trim() }).then(
                          (r) =>
                            notify(
                              true,
                              `已从 ${r.restored} 恢复（安全备份：${r.safety}）`
                            )
                        )
                      )
                    }
                  >
                    {pending ? "恢复中…" : "确认恢复"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost !text-xs"
                    onClick={() => setRestoring(null)}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
