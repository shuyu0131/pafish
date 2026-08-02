"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Copy, Trash2, ExternalLink, Upload, Globe, Search, X, Link2,
} from "lucide-react";
import { deleteUpload } from "@/app/admin/actions";
import { kindOf, MediaKindIcon, uploadMedia } from "./upload-image";

interface UploadItem {
  id: string;
  originalName: string;
  url: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

// 类型筛选（与媒体库 API 的 type 参数一致）
const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "全部" },
  { value: "image", label: "图片" },
  { value: "doc", label: "文档" },
  { value: "archive", label: "压缩包" },
  { value: "audio", label: "音频" },
  { value: "video", label: "视频" },
];

export function UploadsManager({
  uploads,
  total,
  page,
  totalPages,
  q = "",
  type = "",
}: {
  uploads: UploadItem[];
  total: number;
  page: number;
  totalPages: number;
  q?: string;
  type?: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [qInput, setQInput] = useState(q);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingName, setUploadingName] = useState("");
  const [externalOpen, setExternalOpen] = useState(false);
  const [extUrl, setExtUrl] = useState("");
  const [extName, setExtName] = useState("");
  const [extError, setExtError] = useState("");
  const [extSaving, setExtSaving] = useState(false);

  function baseHref() {
    const params = new URLSearchParams();
    if (qInput.trim()) params.set("q", qInput.trim());
    if (type) params.set("type", type);
    return `/admin/uploads?${params.toString()}`;
  }

  function onSearchChange(v: string) {
    setQInput(v);
    if (searchTimer) clearTimeout(searchTimer);
    // 输入停止 500ms 后触发搜索
    setSearchTimer(
      setTimeout(() => {
        const params = new URLSearchParams();
        if (v.trim()) params.set("q", v.trim());
        if (type) params.set("type", type);
        router.push(`/admin/uploads?${params.toString()}`);
      }, 500)
    );
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      setUploadingName(files[i].name);
      try {
        await uploadMedia(files[i]);
      } catch {
        failed++;
      }
    }
    setUploading(false);
    setUploadingName("");
    if (failed > 0) {
      alert(`${failed} 个文件上传失败（检查类型与大小限制）`);
    }
    router.refresh();
  }

  async function saveExternal(e: React.FormEvent) {
    e.preventDefault();
    setExtError("");
    setExtSaving(true);
    try {
      const res = await fetch("/api/uploads/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: extUrl, name: extName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "添加失败");
      setExternalOpen(false);
      setExtUrl("");
      setExtName("");
      router.refresh();
    } catch (err) {
      setExtError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setExtSaving(false);
    }
  }

  function formatSize(bytes: number) {
    if (bytes <= 0) return "外部";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  async function copyUrl(u: UploadItem) {
    try {
      await navigator.clipboard.writeText(u.url);
      setCopied(u.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // 剪贴板不可用时降级：提示手动复制
      setCopied(u.id);
      setTimeout(() => setCopied(null), 1500);
    }
  }

  async function remove(u: UploadItem) {
    if (!confirm(`确定删除「${u.originalName}」？\n\n已在文章中引用的文件将无法显示（不可恢复）。`)) {
      return;
    }
    setDeleting(u.id);
    try {
      await deleteUpload(BigInt(u.id));
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
      setDeleting(null);
    }
  }

  function pageHref(n: number) {
    const params = new URLSearchParams();
    if (qInput.trim()) params.set("q", qInput.trim());
    if (type) params.set("type", type);
    params.set("page", String(n));
    return `/admin/uploads?${params.toString()}`;
  }

  const pageNumbers: number[] = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="space-y-4">
      {/* 工具栏：搜索 / 类型筛选 / 上传 / 外部资源 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={qInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索文件名…"
            className="input !pl-8 !py-2 !text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value || "all"}
              type="button"
              onClick={() => {
                const params = new URLSearchParams();
                if (qInput.trim()) params.set("q", qInput.trim());
                if (f.value) params.set("type", f.value);
                router.push(`/admin/uploads?${params.toString()}`);
              }}
              className={`btn !px-3 !py-2 !text-sm ${type === f.value ? "btn-primary" : "btn-ghost"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label
          className={`btn btn-primary !py-2 !text-sm ${uploading ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
        >
          <Upload size={14} className={uploading ? "animate-pulse" : ""} />
          {uploading ? `上传中：${uploadingName.slice(0, 12)}…` : "上传媒体"}
          <input type="file" multiple className="hidden" onChange={onPickFiles} />
        </label>
        <button type="button" onClick={() => setExternalOpen(true)} className="btn btn-outline !py-2 !text-sm">
          <Link2 size={14} />
          添加外部资源
        </button>
      </div>

      {/* 媒体网格 */}
      {uploads.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center">
          <p className="text-sm font-medium">
            {(q || type) ? "没有符合筛选条件的媒体" : "还没有媒体"}
          </p>
          <p className="text-sm text-muted">
            {(q || type)
              ? "试试调整搜索词或类型筛选"
              : "在文章编辑器中上传，或点击上方“上传媒体”按钮"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {uploads.map((u) => {
            const kind = kindOf(u.url, u.mime);
            const ext = (u.url.split(".").pop() ?? "").toUpperCase();
            const isExternal = !u.url.startsWith("/uploads/");
            return (
              <div key={u.id} className="card group overflow-hidden">
                {kind === "image" ? (
                  <div className="relative flex h-36 items-center justify-center border-b border-border bg-[#fafafa]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={u.url}
                      alt={u.originalName}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain"
                    />
                    {isExternal && (
                      <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded bg-card/90 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        <Globe size={10} /> 外链
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="relative flex h-36 flex-col items-center justify-center gap-1.5 border-b border-border bg-[#fafafa]">
                    <MediaKindIcon kind={kind} size={30} />
                    <span className="rounded bg-border/60 px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted">
                      {ext || "LINK"}
                    </span>
                    {isExternal && (
                      <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded bg-card/90 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        <Globe size={10} /> 外链
                      </span>
                    )}
                  </div>
                )}
                <div className="space-y-1.5 p-3">
                  <p className="truncate text-xs font-medium" title={u.originalName}>
                    {u.originalName}
                  </p>
                  <p className="text-[11px] text-muted">
                    {kind === "image" && u.width && u.height ? `${u.width}×${u.height} · ` : ""}
                    {formatSize(u.size)} · {u.createdAt}
                  </p>
                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => copyUrl(u)}
                      className="btn btn-outline flex-1 !px-2 !py-1.5 !text-xs"
                      title="复制文件 URL"
                    >
                      <Copy size={12} />
                      {copied === u.id ? "已复制" : "复制 URL"}
                    </button>
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost !px-2 !py-1.5 !text-xs"
                      title="新窗口打开"
                    >
                      <ExternalLink size={12} />
                    </a>
                    <button
                      type="button"
                      onClick={() => remove(u)}
                      disabled={deleting === u.id}
                      className="btn btn-ghost !px-2 !py-1.5 !text-xs !text-danger hover:!bg-danger/10"
                      title="删除文件"
                    >
                      {deleting === u.id ? "…" : <Trash2 size={12} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-1.5">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="btn btn-ghost !px-3 !py-1.5 !text-sm">
              上一页
            </Link>
          )}
          {pageNumbers.map((n) => (
            <Link
              key={n}
              href={pageHref(n)}
              className={`btn !px-3 !py-1.5 !text-sm ${n === page ? "btn-primary" : "btn-ghost"}`}
            >
              {n}
            </Link>
          ))}
          {page < totalPages && (
            <Link href={pageHref(page + 1)} className="btn btn-ghost !px-3 !py-1.5 !text-sm">
              下一页
            </Link>
          )}
        </nav>
      )}

      {/* 外部资源弹窗 */}
      {externalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setExternalOpen(false)} />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold tracking-tight">添加外部资源</h3>
                  <button
                    type="button"
                    onClick={() => setExternalOpen(false)}
                    className="btn btn-ghost !p-1.5"
                    aria-label="关闭"
                    title="关闭"
                  >
                    <X size={16} />
                  </button>
                </div>
                <form onSubmit={saveExternal} className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">
                      资源地址（图片直链 / 文件下载链接等）
                    </label>
                    <input
                      value={extUrl}
                      onChange={(e) => setExtUrl(e.target.value)}
                      placeholder="https://example.com/image.png"
                      className="input !py-2 !text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">
                      显示名称（可选，默认取地址文件名）
                    </label>
                    <input
                      value={extName}
                      onChange={(e) => setExtName(e.target.value)}
                      placeholder="示例：官网 Banner"
                      className="input !py-2 !text-sm"
                    />
                  </div>
                  {extError && <p className="text-xs text-danger">{extError}</p>}
                  <p className="text-xs text-muted">
                    仅保存链接不下载文件；图片可在编辑器直接插入，其他链接插入为下载链接
                  </p>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setExternalOpen(false)} className="btn btn-ghost !py-2 !text-sm">
                      取消
                    </button>
                    <button type="submit" disabled={extSaving} className="btn btn-primary !py-2 !text-sm">
                      {extSaving ? "添加中…" : "添加"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
