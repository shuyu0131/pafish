import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyEmailCode } from "@/lib/email-code";

// 通过邮箱验证码重置密码：验证码校验成功后直接改密码（验证码一次性）
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const code = String(body?.code ?? "").trim();
  const newPassword = String(body?.newPassword ?? "");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }
  if (newPassword.length < 6 || newPassword.length > 72) {
    return NextResponse.json({ error: "密码长度需 6-72 位" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, disabled: true },
  });
  if (!user || user.disabled) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // 校验失败统一提示（含过期 / 不存在 / 已使用）
  const ok = await verifyEmailCode(email, "reset", code);
  if (!ok) {
    return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hash(newPassword, 10),
      resetToken: null,
      resetTokenExpires: null,
    },
  });

  return NextResponse.json({ ok: true });
}
