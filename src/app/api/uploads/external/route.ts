import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { extToMime } from "@/lib/media-filter";

// 添加外部资源：仅记录 URL 到媒体库，不下载文件（图片直链/网盘链接等均可）
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: BigInt(session.id) },
    select: { role: true },
  });
  if (!user || !canManagePosts(user.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const url = String(body?.url ?? "").trim();
  if (!url) {
    return NextResponse.json({ error: "请输入资源地址" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { error: "仅支持 http/https 开头的完整地址" },
      { status: 400 }
    );
  }
  if (url.length > 500) {
    return NextResponse.json({ error: "地址过长（最多 500 字符）" }, { status: 400 });
  }
  // 去 query/hash 取文件名做展示名（如 https://x.com/a.png?v=1 → a.png）
  const pathPart = url.split(/[?#]/)[0];
  const filePart = decodeURIComponent(pathPart.split("/").pop() ?? "");
  const customName = String(body?.name ?? "").trim();
  const originalName = customName || filePart || "外部资源";
  const ext = filePart.includes(".") ? filePart.split(".").pop() ?? "" : "";

  const up = await prisma.upload.create({
    data: {
      originalName: originalName.slice(0, 100),
      url,
      mime: extToMime(ext),
      size: 0,
    },
  });

  return NextResponse.json({ id: String(up.id), url, originalName });
}
