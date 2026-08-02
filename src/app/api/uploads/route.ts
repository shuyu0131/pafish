import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { buildTypeWhere, MEDIA_TYPES, type MediaType } from "@/lib/media-filter";

const PAGE_SIZE = 24;

// 媒体库列表（编辑器插入弹窗 / 媒体库页共用）
export async function GET(req: NextRequest) {
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

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const q = (sp.get("q") ?? "").trim();
  const rawType = sp.get("type") ?? "";
  const type = (MEDIA_TYPES as readonly string[]).includes(rawType)
    ? (rawType as MediaType)
    : undefined;

  const where: Record<string, unknown> = {};
  if (q) where.originalName = { contains: q };
  Object.assign(where, buildTypeWhere(type));

  const [total, items] = await Promise.all([
    prisma.upload.count({ where }),
    prisma.upload.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        originalName: true,
        url: true,
        mime: true,
        size: true,
        width: true,
        height: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    items: items.map((u) => ({ ...u, id: String(u.id) })),
    total,
    page,
    pageSize: PAGE_SIZE,
  });
}
