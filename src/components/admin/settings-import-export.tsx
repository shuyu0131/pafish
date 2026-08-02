"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { importThemeSettings } from "@/app/admin/appearance/actions";

// 主题设置 JSON 备份/恢复：导出由客户端 Blob 生成（值已由服务端注入），导入走 server action
export function SettingsImportExport({
  theme,
  values,
  canEdit,
}: {
  theme: string;
  values: Record<string, string>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, setPending] = useState(false);

  function exportJson() {
    const payload = {
      format: "blogcms-theme-settings",
      theme,
      exportedAt: new Date().toISOString(),
      values,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `theme-${theme}-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (
      !window.confirm(
        "导入将覆盖当前主题的全部设置，确定继续吗？\n（建议先导出留底）"
      )
    ) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setError("");
    setDone("");
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await importThemeSettings(fd);
      setDone(`已导入 ${res.imported}/${res.total} 项设置。`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="card space-y-4 p-6">
      <div>
        <h2 className="text-sm font-medium">设置备份与恢复</h2>
        <p className="mt-0.5 text-xs text-muted">
          导出当前主题设置（JSON），或导入备份恢复——仅接受本主题声明的设置项，其他键自动忽略。
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-outline !px-3 !py-1.5 !text-xs"
          onClick={exportJson}
        >
          导出设置
        </button>
        {canEdit && (
          <>
            <button
              type="button"
              className="btn btn-outline !px-3 !py-1.5 !text-xs"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
            >
              {pending ? "导入中…" : "导入设置"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => importJson(e.target.files)}
            />
          </>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {done && <p className="text-sm text-accent">✓ {done}</p>}
    </div>
  );
}
