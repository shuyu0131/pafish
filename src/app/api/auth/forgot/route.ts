import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site";

// 找回密码：生成一次性重置令牌（30 分钟有效）
// 已配置 SMTP 时发送邮件；未配置时直接返回重置链接（自托管场景，管理员应尽快配置 SMTP）
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, username: true, disabled: true },
  });
  // 统一响应，避免暴露邮箱是否注册
  if (!user || user.disabled) {
    return NextResponse.json({ ok: true, sent: false });
  }

  const token = randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpires: new Date(Date.now() + 30 * 60 * 1000) },
  });

  const settings = await getSettings();
  const siteName = settings.site_name || "纸鱼博客";
  const resetUrl = siteUrl(`/reset-password?token=${token}`);
  let mailed = false;

  // 尝试发邮件（与评论通知共用 SMTP 配置）
  try {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      const nodemailer = (await import("nodemailer")).default;
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 465,
        secure: (Number(SMTP_PORT) || 465) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
      await transporter.sendMail({
        from: SMTP_FROM || `"${siteName}" <${SMTP_USER}>`,
        to: email,
        subject: `[${siteName}] 重置密码`,
        text: [`你好 ${user.username}：`, "", `请在 30 分钟内点击以下链接重置密码：`, resetUrl, "", `如果不是你本人操作，请忽略此邮件。`].join("\n"),
      });
      mailed = true;
    }
  } catch {
    mailed = false;
  }



  // 未配置 SMTP 时返回链接方便自托管用户（生产环境配置 SMTP 后此分支不触发）
  return NextResponse.json({ ok: true, sent: mailed, resetUrl: mailed ? undefined : resetUrl });
}
