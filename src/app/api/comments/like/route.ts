import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { COMMENT_STATUS } from "@/lib/constants";

const COOKIE = "liked_comments";
// 每人最多点赞的评论数（防止 cookie 无限膨胀）
const MAX_LIKED = 200;

// 评论点赞/取消点赞：用 cookie 记录已点赞的评论，同一浏览器可再点取消
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const raw = String(body?.commentId ?? "");
  if (!/^\d+$/.test(raw)) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }
  const id = BigInt(raw);

  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { status: true, likeCount: true },
  });
  if (!comment || comment.status !== COMMENT_STATUS.APPROVED) {
    return NextResponse.json({ error: "评论不存在" }, { status: 404 });
  }

  const store = await cookies();
  const liked = (store.get(COOKIE)?.value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const key = String(id);
  const isLiked = liked.includes(key);

  if (isLiked) {
    // 取消点赞（计数不小于 0）
    if ((comment.likeCount ?? 0) > 0) {
      await prisma.comment.update({
        where: { id },
        data: { likeCount: { decrement: 1 } },
      });
    }
    store.set(COOKIE, liked.filter((x) => x !== key).join(","), {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  } else {
    await prisma.comment.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
    });
    liked.push(key);
    if (liked.length > MAX_LIKED) liked.splice(0, liked.length - MAX_LIKED);
    store.set(COOKIE, liked.join(","), {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  const updated = await prisma.comment.findUnique({
    where: { id },
    select: { likeCount: true },
  });
  return NextResponse.json({
    liked: !isLiked,
    count: updated?.likeCount ?? 0,
  });
}
