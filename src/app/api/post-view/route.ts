import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 浏览量去重：每个浏览器（7 天 cookie）只记一次
// cookie 名按文章 id 区分，避免多篇文章互相覆盖
const COOKIE_PREFIX = "blog_viewed_";
const MAX_AGE = 7 * 24 * 60 * 60; // 7 天

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const postIdRaw = String(body?.postId ?? "");
  if (!/^\d+$/.test(postIdRaw)) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const cookieName = `${COOKIE_PREFIX}${postIdRaw}`;
  if (req.cookies.get(cookieName)) {
    return NextResponse.json({ ok: true, counted: false });
  }

  const post = await prisma.post.findUnique({
    where: { id: BigInt(postIdRaw), deletedAt: null },
    select: { id: true },
  });
  if (!post) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  await prisma.post.update({
    where: { id: post.id },
    data: { viewCount: { increment: 1 } },
  });

  const res = NextResponse.json({ ok: true, counted: true });
  res.cookies.set(cookieName, "1", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
  return res;
}
