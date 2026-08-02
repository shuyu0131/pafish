import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

// 使用一次性令牌重置密码
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");

  if (password.length < 6 || password.length > 72) {
    return NextResponse.json({ error: "密码长度需 6-72 位" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpires: { gt: new Date() },
    },
    select: { id: true, username: true, disabled: true },
  });
  if (!user) {
    return NextResponse.json({ error: "重置链接无效或已过期" }, { status: 400 });
  }
  if (user.disabled) {
    return NextResponse.json({ error: "账号已被禁用，请联系管理员" }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hash(password, 10),
      resetToken: null,
      resetTokenExpires: null,
    },
  });



  return NextResponse.json({ ok: true });
}
