import "server-only";

// 媒体类型过滤与外部资源 MIME 推断（媒体库页 / 媒体库 API 共用）

export const MEDIA_TYPES = ["image", "doc", "archive", "audio", "video"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_TYPE_LABEL: Record<MediaType, string> = {
  image: "图片",
  doc: "文档",
  archive: "压缩包",
  audio: "音频",
  video: "视频",
};

const EXT_GROUPS: Record<MediaType, string[]> = {
  image: ["png", "jpg", "jpeg", "gif", "webp", "svg"],
  doc: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "csv"],
  archive: ["zip", "rar", "7z", "tar", "gz"],
  audio: ["mp3", "wav", "ogg", "m4a", "flac"],
  video: ["mp4", "webm", "mov", "mkv"],
};

const MIME_PREFIX: Record<MediaType, string> = {
  image: "image/",
  doc: "application/",
  archive: "application/",
  audio: "audio/",
  video: "video/",
};

// 构建媒体库列表的 Prisma where 条件（mime 前缀 或 URL 扩展名兜底，外部资源/旧数据可能 MIME 不准）
// 注意：不用字段级嵌套 OR（{ url: { OR: [...] } }），该 Prisma 版本不支持，改为顶层平铺
export function buildTypeWhere(type: MediaType | undefined) {
  if (!type) return {};
  const exts = EXT_GROUPS[type];
  return {
    OR: [
      { mime: { startsWith: MIME_PREFIX[type] } },
      ...exts.map((ext) => ({ url: { endsWith: `.${ext}` } })),
    ],
  };
}

// 外部资源：按扩展名推断 MIME（无扩展名时回退 octet-stream）
const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
};

export function extToMime(ext: string): string {
  return EXT_MIME[ext.toLowerCase()] ?? "application/octet-stream";
}

export function isLocalUpload(url: string): boolean {
  return url.startsWith("/uploads/");
}
