import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site";

export type NotificationType = "NEW_COMMENT" | "NEW_REPLY";

// 站内通知：新评论/新回复写入 notifications 表（后台铃铛 + 列表页）
export async function createNotification(input: {
  type: NotificationType;
  message: string;
  postId?: bigint | null;
  commentId?: bigint | null;
}) {
  await prisma.notification.create({
    data: {
      type: input.type,
      message: input.message,
      postId: input.postId ?? null,
      commentId: input.commentId ?? null,
    },
  });
}

// 创建 SMTP 发信器；未配置 SMTP 返回 null（不抛错，调用方静默跳过）
// 配置优先级：设置表（后台可配）> .env 兜底（向后兼容）
async function createTransporter(): Promise<{
  transporter: Transporter;
  siteName: string;
  from: string;
} | null> {
  const settings = await getSettings();
  const host = settings.smtp_host || process.env.SMTP_HOST;
  const port = Number(settings.smtp_port || process.env.SMTP_PORT) || 465;
  const user = settings.smtp_user || process.env.SMTP_USER;
  const pass = settings.smtp_pass || process.env.SMTP_PASS;
  const from = settings.smtp_from || process.env.SMTP_FROM;
  if (!host || !user || !pass) return null;
  const siteName = settings.site_name || "纸鱼博客";
  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    }),
    siteName,
    from: from || `"${siteName}" <${user}>`,
  };
}

// 发信失败时抛错（供测试邮件等需要感知结果的场景使用）
// cfg 传入时优先使用该配置（后台测试按钮用表单当前值，未保存也能测），否则读设置表/.env
async function sendMail(
  input: { to: string; subject: string; text: string },
  cfg?: SmtpConfig
): Promise<void> {
  let transporter: Transporter;
  let from: string;
  let siteName = "";
  if (cfg) {
    const port = Number(cfg.port) || 465;
    transporter = nodemailer.createTransport({
      host: cfg.host,
      port,
      secure: port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    from = cfg.from || `"${cfg.user}" <${cfg.user}>`;
  } else {
    const mail = await createTransporter();
    if (!mail) throw new Error("邮件服务未配置（请在后台设置 SMTP）");
    transporter = mail.transporter;
    from = mail.from;
    siteName = mail.siteName;
  }
  await transporter.sendMail({
    from,
    to: input.to,
    subject: siteName ? `[${siteName}] ${input.subject}` : input.subject,
    text: input.text,
  });
}

export interface SmtpConfig {
  host: string;
  port: string;
  user: string;
  pass: string;
  from: string;
}

// 发送测试邮件：验证后台 SMTP 配置是否可用；失败抛错给调用方展示
export async function sendTestMail(to: string, cfg?: SmtpConfig): Promise<void> {
  const settings = await getSettings();
  const siteName = settings.site_name || "纸鱼博客";
  await sendMail(
    {
      to,
      subject: "SMTP 配置测试",
      text: [
        `你好：`,
        "",
        `这是一封来自「${siteName}」的测试邮件，说明 SMTP 配置已生效。`,
        "",
        `如果你收到这封邮件，无需回复。`,
      ].join("\n"),
    },
    cfg
  );
}

// 发送邮箱验证码（注册 / 忘记密码统一入口）；发信失败抛错给调用方处理
export async function sendEmailCode(
  email: string,
  code: string,
  purpose: "register" | "reset"
): Promise<void> {
  const settings = await getSettings();
  const siteName = settings.site_name || "纸鱼博客";
  const isRegister = purpose === "register";
  await sendMail({
    to: email,
    subject: isRegister ? "注册验证码" : "重置密码验证码",
    text: [
      `你好：`,
      "",
      isRegister
        ? `你正在注册「${siteName}」账号，验证码为：`
        : `你正在找回「${siteName}」账号密码，验证码为：`,
      "",
      `  ${code}  `,
      "",
      `验证码 10 分钟内有效。如果不是你本人操作，请忽略此邮件。`,
    ].join("\n"),
  });
}

interface EmailContext {
  commenter: string;
  isReply: boolean;
  postTitle: string;
  postSlug: string;
  commentId: bigint;
  content: string;
}

// 站长邮件提醒：站点设置开启 + .env 配置 SMTP 后生效；发信失败静默，不影响主流程
export async function sendCommentEmail(ctx: EmailContext) {
  const settings = await getSettings();
  if (settings.notify_email_enabled !== "true" || !settings.notify_email) {
    return;
  }
  const mail = await createTransporter();
  if (!mail) return;

  try {
    const postUrl = siteUrl(`/post/${encodeURIComponent(ctx.postSlug)}`);
    const adminUrl = siteUrl("/admin/comments?status=PENDING");
    await mail.transporter.sendMail({
      from: mail.from,
      to: settings.notify_email,
      subject: `[${mail.siteName}] 收到新${ctx.isReply ? "回复" : "评论"}：《${ctx.postTitle}》`,
      text: [
        `${ctx.commenter} 在文章《${ctx.postTitle}》下发表了${ctx.isReply ? "回复" : "评论"}：`,
        "",
        ctx.content,
        "",
        `查看文章：${postUrl}`,
        `审核评论：${adminUrl}`,
      ].join("\n"),
    });
  } catch {
    // 邮件发送失败不阻塞评论流程
  }
}

// 被回复者邮件通知：评论者勾选"有新回复邮件通知我"后，有人回复时发信
export async function sendReplyEmail(input: {
  toEmail: string;
  replier: string;
  replyContent: string;
  postTitle: string;
  postSlug: string;
  commentId: bigint; // 被回复的评论 id（邮件里带锚点）
}) {
  const mail = await createTransporter();
  if (!mail) return;

  try {
    const threadUrl = siteUrl(
      `/post/${encodeURIComponent(input.postSlug)}#comment-${input.commentId}`
    );
    await mail.transporter.sendMail({
      from: mail.from,
      to: input.toEmail,
      subject: `[${mail.siteName}] ${input.replier} 回复了你在《${input.postTitle}》下的评论`,
      text: [
        `${input.replier} 回复了你在《${input.postTitle}》下的评论：`,
        "",
        input.replyContent,
        "",
        `查看回复：${threadUrl}`,
      ].join("\n"),
    });
  } catch {
    // 邮件发送失败不阻塞评论流程
  }
}
