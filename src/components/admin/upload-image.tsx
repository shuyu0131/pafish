"use client";

import { FileText, FileArchive, FileAudio, FileVideo, File } from "lucide-react";

// 上传媒体到媒体库（图片自动压缩），返回 URL
export async function uploadMedia(file: File): Promise<{ url: string; mime: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "上传失败");
  return { url: data.url as string, mime: (data.mime as string) ?? file.type };
}

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
const ARCHIVE_EXTS = ["zip", "rar", "7z", "tar", "gz"];

export type MediaKind = "image" | "video" | "audio" | "archive" | "doc";

// 按扩展名 + MIME 判断媒体类型（扩展名优先，MIME 可能为 octet-stream）
export function kindOf(url: string, mime: string): MediaKind {
  const ext = (url.split(".").pop() ?? "").toLowerCase();
  if (mime.startsWith("image/") || IMAGE_EXTS.includes(ext)) return "image";
  if (mime.startsWith("video/") || ["mp4", "webm", "mov", "mkv"].includes(ext)) return "video";
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) return "audio";
  if (ARCHIVE_EXTS.includes(ext) || mime.includes("zip") || mime.includes("compressed")) return "archive";
  return "doc";
}

export const KIND_LABEL: Record<MediaKind, string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
  archive: "压缩包",
  doc: "文档",
};

export function MediaKindIcon({ kind, size = 22 }: { kind: MediaKind; size?: number }) {
  switch (kind) {
    case "video": return <FileVideo size={size} className="text-muted" />;
    case "audio": return <FileAudio size={size} className="text-muted" />;
    case "archive": return <FileArchive size={size} className="text-muted" />;
    case "doc": return <FileText size={size} className="text-muted" />;
    default: return <File size={size} className="text-muted" />;
  }
}
