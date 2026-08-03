import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const COOKIE = "favorited_posts";
// 每人最多收藏的文章数（防止 cookie 无限膨胀）
const MAX_FAVORITED = 200;

// 文章收藏/取消收藏：cookie 记录已收藏文章，同一浏览器可再点取消
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const raw = String(body?.postId ?? "");
  if (!/^\d+$/.test(raw)) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }
  const id = BigInt(raw);

  const post = await prisma.post.findUnique({
    where: { id },
    select: { status: true, deletedAt: true, favoriteCount: true },
  });
  if (!post || post.status !== "PUBLISHED" || post.deletedAt) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  const store = await cookies();
  const favorited = (store.get(COOKIE)?.value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const key = String(id);
  const isFavorited = favorited.includes(key);

  if (isFavorited) {
    // 取消收藏（计数不小于 0）
    if ((post.favoriteCount ?? 0) > 0) {
      await prisma.post.update({
        where: { id },
        data: { favoriteCount: { decrement: 1 } },
      });
    }
    store.set(COOKIE, favorited.filter((x) => x !== key).join(","), {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  } else {
    await prisma.post.update({
      where: { id },
      data: { favoriteCount: { increment: 1 } },
    });
    favorited.push(key);
    if (favorited.length > MAX_FAVORITED) favorited.splice(0, favorited.length - MAX_FAVORITED);
    store.set(COOKIE, favorited.join(","), {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  const updated = await prisma.post.findUnique({
    where: { id },
    select: { favoriteCount: true },
  });
  return NextResponse.json({
    favorited: !isFavorited,
    count: updated?.favoriteCount ?? 0,
  });
}
