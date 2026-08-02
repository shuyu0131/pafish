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
async function createTransporter(): Promise<{
  transporter: Transporter;
  siteName: string;
  from: string;
} | null> {
  const [settings, host, port, user, pass, from] = await Promise.all([
    getSettings(),
    Promise.resolve(process.env.SMTP_HOST),
    Promise.resolve(process.env.SMTP_PORT),
    Promise.resolve(process.env.SMTP_USER),
    Promise.resolve(process.env.SMTP_PASS),
    Promise.resolve(process.env.SMTP_FROM),
  ]);
  if (!host || !user || !pass) return null;
  const siteName = settings.site_name || "纸鱼博客";
  return {
    transporter: nodemailer.createTransport({
      host,
      port: Number(port) || 465,
      secure: (Number(port) || 465) === 465,
      auth: { user, pass },
    }),
    siteName,
    from: from || `"${siteName}" <${user}>`,
  };
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
