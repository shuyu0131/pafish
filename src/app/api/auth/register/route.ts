import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { verifyEmailCode } from "@/lib/email-code";
import { doAction } from "@/lib/hooks";

// 开放注册（站点设置 allow_registration 控制）
// 开启 require_email_verify（默认开启）时，必须携带通过校验的邮箱验证码
export async function POST(req: NextRequest) {
  const settings = await getSettings();
  if (settings.allow_registration === "false") {
    return NextResponse.json({ error: "注册已关闭" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim().slice(0, 50);
  const email = String(body?.email ?? "").trim().slice(0, 255);
  const password = String(body?.password ?? "");
  const code = String(body?.code ?? "").trim();

  if (!/^[\w\u4e00-\u9fa5-]{2,50}$/.test(username)) {
    return NextResponse.json(
      { error: "用户名需 2-50 位，仅限中文、字母、数字、下划线和连字符" },
      { status: 400 }
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }
  if (password.length < 6 || password.length > 72) {
    return NextResponse.json({ error: "密码长度需 6-72 位" }, { status: 400 });
  }

  // 邮箱验证码：站点开启时必须通过（校验通过后自动标记已使用）；默认开启
  if (settings.require_email_verify !== "false") {
    if (!(await verifyEmailCode(email.toLowerCase(), "register", code))) {
      return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
    }
  }

  const exists = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { username: true, email: true },
  });
  if (exists) {
    return NextResponse.json(
      { error: exists.username === username ? "用户名已被占用" : "邮箱已被注册" },
      { status: 409 }
    );
  }

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: await hash(password, 10),
      role: "USER",
    },
  });



  // 注册后自动登录
  await createSession({ id: user.id, username: user.username, role: user.role });

  // 钩子：注册成功
  await doAction("after_register", {
    id: String(user.id),
    username: user.username,
  });

  return NextResponse.json({ ok: true, username: user.username });
}
