import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { doAction } from "@/lib/hooks";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  if (!username || !password) {
    return NextResponse.json({ error: "请输入用户名和密码" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, passwordHash: true, role: true, disabled: true },
  });

  if (!user || !(await compare(password, user.passwordHash))) {

    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  if (user.disabled) {

    return NextResponse.json({ error: "账号已被禁用，请联系管理员" }, { status: 403 });
  }

  await createSession({
    id: user.id,
    username: user.username,
    role: user.role,
  });

  // 钩子：登录成功
  await doAction("after_login", {
    id: String(user.id),
    username: user.username,
    role: user.role,
  });

  return NextResponse.json({ ok: true, username: user.username, role: user.role });
}
