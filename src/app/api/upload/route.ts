import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { storeToCloud } from "@/lib/plugin-storage";

// 媒体库支持的扩展名（按类型分组，压缩/展示逻辑据此判断）
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const DOC_EXT = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "csv",
]);
const ARCHIVE_EXT = new Set(["zip", "rar", "7z", "tar", "gz"]);
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "m4a", "flac"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "mkv"]);
const ALLOWED_EXT = new Set([
  ...IMAGE_EXT, ...DOC_EXT, ...ARCHIVE_EXT, ...AUDIO_EXT, ...VIDEO_EXT,
]);

const MAX_WIDTH = 1920; // 图片长边超过则缩放
const QUALITY = 82; // JPEG/WebP 压缩质量

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 大小限制可在站点设置中调整（默认 20MB）；部分服务器（Nginx 等）默认请求体限制较小，需同步调整
  const maxMb = Math.min(200, Math.max(1, Number(await getSetting("upload_max_mb", "20")) || 20));
  const MAX_SIZE = maxMb * 1024 * 1024;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "未找到上传文件" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase().replace(".", "") || "bin";
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: "不支持的文件类型，仅支持图片 / 文档 / 压缩包 / 音视频" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `文件不能超过 ${maxMb}MB（可在站点设置调整）` },
      { status: 400 }
    );
  }

  const originalName = path.basename(file.name, path.extname(file.name)).slice(0, 100);
  const mime = file.type || "application/octet-stream";
  let buf = Buffer.from(await file.arrayBuffer());
  let width: number | null = null;
  let height: number | null = null;

  // 仅图片走自动压缩（GIF/SVG 跳过：GIF 压缩会丢动画，SVG 是矢量文本；其余类型原样存储）
  if (IMAGE_EXT.has(ext) && ext !== "gif" && ext !== "svg") {
    try {
      let pipeline = sharp(buf, { failOn: "none" }).rotate(); // 修正 EXIF 方向
      const meta = await pipeline.metadata();
      if ((meta.width ?? 0) > MAX_WIDTH) {
        pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
      }
      if (ext === "png") {
        buf = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      } else if (ext === "webp") {
        buf = await pipeline.webp({ quality: QUALITY }).toBuffer();
      } else {
        buf = await pipeline.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
      }
      const outMeta = await sharp(buf).metadata();
      width = outMeta.width ?? null;
      height = outMeta.height ?? null;
    } catch {
      // 压缩失败则保存原图（如异常编码）
      buf = Buffer.from(await file.arrayBuffer());
    }
  }

  // 云存储接管：激活插件声明 storage 时优先上传云端（成功则不落本地磁盘）；
  // 失败/无插件自动回退本地（与"压缩失败回退原图"同容错哲学）
  const cloud = await storeToCloud({
    buffer: buf,
    ext,
    mime,
    originalName,
    size: buf.length,
    width,
    height,
  });
  let url: string;
  if (cloud) {
    url = cloud.url;
  } else {
    const filename = `${crypto.randomBytes(8).toString("hex")}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buf);
    url = `/uploads/${filename}`;
  }

  // 入库（媒体库），便于后台统一管理/复用
  await prisma.upload.create({
    data: {
      originalName,
      url,
      mime,
      size: buf.length,
      width,
      height,
      uploaderId: BigInt(session.id),
    },
  });

  return NextResponse.json({ url, mime, size: buf.length });
}
