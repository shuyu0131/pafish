import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";

// 文章密码解锁：bcrypt 校验后写解锁 cookie（24 小时），详情页据此渲染正文
export async function POST(req: NextRequest) {
  const { postId, password } = await req.json().catch(() => ({}));
  if (!postId || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const id = BigInt(String(postId).replace(/\D/g, "") || "0");
  if (id <= 0n) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const post = await prisma.post.findUnique({
    where: { id },
    select: { password: true },
  });
  if (!post?.password) {
    return NextResponse.json({ error: "该文章无需密码" }, { status: 400 });
  }

  const ok = await compare(password, post.password).catch(() => false);
  if (!ok) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(`unlocked_post_${id}`, "1", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 小时
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
