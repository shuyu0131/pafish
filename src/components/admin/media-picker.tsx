"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Upload,
  Search,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { uploadMedia, kindOf, MediaKindIcon } from "./upload-image";

interface MediaItem {
  id: string;
  originalName: string;
  url: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
}

const PAGE_SIZE = 24;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaPicker({
  open,
  onClose,
  onPick,
  imagesOnly = false,
  title = "插入媒体",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (url: string, mime: string, name: string) => void;
  imagesOnly?: boolean; // 仅图片（如封面图选择）
  title?: string;
}) {
  const [tab, setTab] = useState<"upload" | "library">("upload");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 打开时重置状态
  useEffect(() => {
    if (open) {
      setTab("upload");
      setPage(1);
      setQ("");
      setError("");
    }
  }, [open]);

  // 媒体库 Tab 加载列表（搜索 500ms 防抖）
  useEffect(() => {
    if (!open || tab !== "library") return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/uploads?page=${page}&q=${encodeURIComponent(q)}${imagesOnly ? "&type=image" : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tab, page, q, imagesOnly]);

  function onSearchChange(v: string) {
    setQ(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setPage(1), 500);
  }

  async function handleUpload(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    setError("");
    try {
      const { url, mime } = await uploadMedia(f);
      onPick(url, mime, f.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="flex h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          {/* 标题栏 */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost !p-1.5"
              aria-label="关闭"
              title="关闭"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab 切换 */}
          <div className="flex gap-1 border-b border-border px-4 py-2">
            <button
              type="button"
              onClick={() => setTab("upload")}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                tab === "upload"
                  ? "bg-accent-soft font-medium text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              本地上传
            </button>
            <button
              type="button"
              onClick={() => setTab("library")}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                tab === "library"
                  ? "bg-accent-soft font-medium text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              媒体库{total > 0 ? `（${total}）` : ""}
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto p-4">
            {tab === "upload" ? (
              <div className="space-y-3">
                <div
                  className={`flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                    dragOver ? "border-accent bg-accent-soft" : "border-border"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleUpload(e.dataTransfer.files);
                  }}
                >
                  <Upload size={28} className="text-muted" />
                  <p className="text-sm">
                    将文件拖到此处，或{" "}
                    <button
                      type="button"
                      className="font-medium text-accent underline"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                    >
                      点击选择
                    </button>
                  </p>
                  <p className="text-xs text-muted">
                    {imagesOnly
                      ? "仅支持图片，上传后自动压缩并插入"
                      : "支持图片（自动压缩）/ 文档 / 压缩包 / 音视频；大小上限可在“站点设置 → 上传与媒体库”调整"}
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept={
                      imagesOnly
                        ? "image/*"
                        : "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.zip,.rar,.7z,.tar,.gz,.mp3,.wav,.ogg,.m4a,.flac,.mp4,.webm,.mov,.mkv"
                    }
                    disabled={uploading}
                    onChange={(e) => {
                      handleUpload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
                {uploading && <p className="text-center text-sm text-muted">上传中…</p>}
                {error && <p className="text-center text-sm text-danger">{error}</p>}
              </div>
            ) : (
              <div className="space-y-3">
                {/* 搜索 */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    className="input !pl-9 !text-sm"
                    value={q}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="搜索文件名…"
                  />
                </div>

                {loading ? (
                  <p className="py-10 text-center text-sm text-muted">加载中…</p>
                ) : items.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted">
                    {q ? "没有匹配的媒体" : "媒体库还是空的，先切换到“本地上传”吧"}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    {items.map((u) => {
                      const kind = kindOf(u.url, u.mime);
                      const ext = (u.url.split(".").pop() ?? "").toUpperCase();
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => onPick(u.url, u.mime, u.originalName)}
                          className="group flex flex-col overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-accent hover:bg-accent-soft"
                          title={`插入 ${u.originalName}（${formatSize(u.size)}）`}
                        >
                          {kind === "image" ? (
                            <div className="flex h-20 items-center justify-center bg-[#fafafa] p-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={u.url}
                                alt={u.originalName}
                                loading="lazy"
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="flex h-20 flex-col items-center justify-center gap-1 bg-[#fafafa]">
                              <MediaKindIcon kind={kind} />
                              <span className="text-[10px] font-medium uppercase text-muted">{ext}</span>
                            </div>
                          )}
                          <span className="truncate px-2 py-1.5 text-[11px] text-muted group-hover:text-foreground">
                            {u.originalName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 分页 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
                      aria-label="上一页"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs text-muted">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
                      aria-label="下一页"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 底部提示 */}
          <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <ImageIcon size={12} />
              图片插入为 Markdown 图片，其他文件插入为下载链接
            </span>
            <button type="button" onClick={onClose} className="btn btn-ghost !px-3 !py-1.5 !text-xs">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
