"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";

interface ImportResult {
  name: string;
  ok: boolean;
  error?: string;
}

export function ImportMarkdown() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"draft" | "publish">("draft");
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [error, setError] = useState("");

  async function submit() {
    if (files.length === 0) return;
    setError("");
    setResults(null);
    setPending(true);
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      form.append("status", status);
      const res = await fetch("/api/import-markdown", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "导入失败");
      setResults(data.results);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card space-y-4 p-6">
      {/* 文件选择 */}
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-center transition-colors hover:border-accent">
        <FileUp size={28} className="text-muted" />
        <span className="text-sm font-medium">
          {files.length > 0 ? `已选择 ${files.length} 个文件` : "点击选择 .md 文件"}
        </span>
        <span className="text-xs text-muted">
          支持多选，一次最多 50 个，单文件 1MB
        </span>
        <input
          type="file"
          accept=".md,text/markdown,text/plain"
          multiple
          className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </label>

      {files.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-accent-soft p-3 text-xs text-muted">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="shrink-0 text-danger hover:underline"
              >
                移除
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 导入方式 */}
      <div className="flex items-center gap-5">
        <span className="text-sm">导入为：</span>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <input
            type="radio"
            name="status"
            checked={status === "draft"}
            onChange={() => setStatus("draft")}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          草稿（推荐，导入后手动发布）
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <input
            type="radio"
            name="status"
            checked={status === "publish"}
            onChange={() => setStatus("publish")}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          直接发布（frontmatter 的 date 保留为发布时间）
        </label>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {results && (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <p className="text-sm font-medium">
            导入完成：成功 {results.filter((r) => r.ok).length} 篇，
            {results.some((r) => !r.ok) ? `失败 ${results.filter((r) => !r.ok).length} 篇` : "全部成功"}
          </p>
          {results.filter((r) => !r.ok).map((r) => (
            <p key={r.name} className="text-xs text-danger">
              {r.name}：{r.error}
            </p>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn btn-outline"
          disabled={pending || files.length === 0}
          onClick={() => {
            setFiles([]);
            setResults(null);
          }}
        >
          清空
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || files.length === 0}
          onClick={submit}
        >
          {pending ? "导入中…" : `开始导入（${files.length} 篇）`}
        </button>
      </div>
    </div>
  );
}
