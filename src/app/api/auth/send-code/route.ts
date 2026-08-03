import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { createEmailCode, type EmailCodePurpose } from "@/lib/email-code";
import { sendEmailCode } from "@/lib/notify";

// 发送邮箱验证码（注册 / 忘记密码）
// - 注册场景：校验注册开关与邮箱未被注册
// - 忘记密码场景：防枚举——无论邮箱是否存在都返回 ok（不存在则不真正发信）
// - 60 秒限频；SMTP 未配置时返回 400
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const purpose = String(body?.purpose ?? "") as EmailCodePurpose;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }
  if (purpose !== "register" && purpose !== "reset") {
    return NextResponse.json({ error: "用途不正确" }, { status: 400 });
  }

  const settings = await getSettings();
  if (purpose === "register" && settings.allow_registration === "false") {
    return NextResponse.json({ error: "注册已关闭" }, { status: 403 });
  }

  // 注册场景：邮箱已注册则直接提示（防止用验证码探测）；忘记密码场景统一响应防枚举
  if (purpose === "register") {
    const exists = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (exists) {
      return NextResponse.json({ error: "该邮箱已注册，可直接登录" }, { status: 409 });
    }
  }

  const { code, tooFrequent } = await createEmailCode(email, purpose);
  if (tooFrequent) {
    return NextResponse.json({ error: "发送过于频繁，请 60 秒后再试" }, { status: 429 });
  }

  // 忘记密码：用户不存在时静默返回成功（防枚举），不发信
  if (purpose === "reset") {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, disabled: true },
    });
    if (!user || user.disabled) {
      return NextResponse.json({ ok: true });
    }
  }

  try {
    await sendEmailCode(email, code, purpose);
  } catch {
    return NextResponse.json({ error: "邮件服务未配置或发送失败，请联系管理员" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
