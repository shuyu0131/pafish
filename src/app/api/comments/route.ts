import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { COMMENT_STATUS } from "@/lib/constants";
import { createNotification, sendCommentEmail, sendReplyEmail } from "@/lib/notify";
import { getSession } from "@/lib/auth";
import { verifyCaptcha } from "@/lib/captcha";
import { doAction } from "@/lib/hooks";

// ---------- 评论反垃圾 ----------
// 同一 IP 两次评论的最小间隔（毫秒），防止刷评论
const COMMENT_MIN_INTERVAL_MS = 5_000;
// 机器爬虫 UA 关键字（同 emlog 的过滤名单）
const BOT_UA_PATTERN = /bot|crawler|spider|robot|slurp|crawling/i;

// 进程内记录每个 IP 最近一次评论时间（单实例部署足够；重启即重置）
const rateMap = new Map<string, number>();

function isCommentTooFast(ip: string): boolean {
  const now = Date.now();
  const last = rateMap.get(ip) ?? 0;
  if (now - last < COMMENT_MIN_INTERVAL_MS) return true;
  rateMap.set(ip, now);
  // 顺带清理 10 分钟前的记录，防止内存无限增长
  if (rateMap.size > 1000) {
    for (const [k, v] of rateMap) {
      if (now - v > 10 * 60 * 1000) rateMap.delete(k);
    }
  }
  return false;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// 游客评论提交
export async function POST(req: NextRequest) {
  const settings = await getSettings();
  if (settings.comments_enabled === "false") {
    return NextResponse.json({ error: "评论功能已关闭" }, { status: 403 });
  }

  // 反垃圾前置检查：无 UA 或疑似爬虫一律拒绝；同一 IP 限速
  const ua = req.headers.get("user-agent");
  if (!ua || BOT_UA_PATTERN.test(ua)) {
    return NextResponse.json({ error: "评论提交被拒绝" }, { status: 403 });
  }
  // 黑名单 IP（后台按 IP 拉黑）直接拒绝
  // 注意：此处直接查库而非 getSetting——React cache 在 server action 与 route handler
  // 之间可能跨请求缓存旧值，黑名单必须读到最新写入
  const ip = clientIp(req);
  try {
    const row = await prisma.setting.findFirst({ where: { key: "blocked_ips" } });
    const blockedList: string[] = row?.value ? JSON.parse(row.value) : [];
    if (Array.isArray(blockedList) && blockedList.includes(ip)) {
      return NextResponse.json({ error: "评论提交被拒绝" }, { status: 403 });
    }
  } catch {
    // 黑名单数据损坏时忽略，不影响正常评论
  }
  if (isCommentTooFast(ip)) {
    return NextResponse.json({ error: "评论太频繁，请稍后再试" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const postId = String(body?.postId ?? "");

  // 登录检测：已登录用户自动使用登录身份（服务端强制，忽略 body 伪造的昵称/邮箱）
  // 未登录游客必须通过图形验证码（后台可关闭）
  const session = await getSession();

  let name: string;
  let email: string;
  let userId: bigint | null = null;
  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.id) },
      select: { id: true, username: true, nickname: true, email: true, disabled: true },
    });
    // 会话失效（用户被删/被禁）按游客处理
    if (!user || user.disabled) {
      return NextResponse.json({ error: "登录状态已失效，请重新登录" }, { status: 401 });
    }
    userId = user.id;
    name = (user.nickname || user.username).trim().slice(0, 50);
    email = user.email;
  } else {
    // 游客评论验证码：默认开启（未写入设置时按开启处理）
    if (settings.comments_captcha_enabled !== "false") {
      const captchaToken = String(body?.captchaToken ?? "");
      const captchaAnswer = String(body?.captchaAnswer ?? "");
      if (!verifyCaptcha(captchaToken, captchaAnswer)) {
        return NextResponse.json({ error: "验证码错误，请重试" }, { status: 400 });
      }
    }
    name = String(body?.name ?? "").trim().slice(0, 50);
    email = String(body?.email ?? "").trim().slice(0, 255);
  }

  const content = String(body?.content ?? "").trim().slice(0, 2000);
  const parentIdRaw = body?.parentId ? String(body.parentId) : "";
  // 勾选"有新回复邮件通知我"：有人回复这条评论时给评论者发邮件
  const notifyReply = body?.notifyReply === true;

  if (!postId || !name || !content) {
    return NextResponse.json({ error: "昵称和评论内容不能为空" }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }

  const post = await prisma.post.findUnique({
    where: { id: BigInt(postId), deletedAt: null },
    select: { id: true, status: true, title: true, slug: true },
  });
  if (!post || post.status !== "PUBLISHED") {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  // 回复校验：父评论必须存在、属于同一篇文章且已通过审核
  let parentId: bigint | null = null;
  let parentEmail: string | null = null;
  if (parentIdRaw) {
    const parent = await prisma.comment.findUnique({
      where: { id: BigInt(parentIdRaw) },
      select: { id: true, postId: true, status: true, authorEmail: true },
    });
    if (!parent || parent.postId !== post.id) {
      return NextResponse.json({ error: "回复的评论不存在" }, { status: 400 });
    }
    if (parent.status !== COMMENT_STATUS.APPROVED) {
      return NextResponse.json({ error: "只能回复已通过的评论" }, { status: 400 });
    }
    parentId = parent.id;
    parentEmail = parent.authorEmail;
  }

  // 重复检测：同一文章 + 昵称 + 内容在 1 小时内只允许提交一次
  const dup = await prisma.comment.findFirst({
    where: {
      postId: post.id,
      authorName: name,
      content,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json({ error: "请勿重复提交相同评论" }, { status: 429 });
  }

  const needReview = settings.comments_need_review !== "false";
  const comment = await prisma.comment.create({
    data: {
      postId: post.id,
      authorName: name,
      authorEmail: email,
      userId,
      content,
      status: needReview ? COMMENT_STATUS.PENDING : COMMENT_STATUS.APPROVED,
      parentId,
      notifyReply,
      ip: ip === "unknown" ? null : ip,
    },
  });

  // 站内通知（后台铃铛）+ 可选邮件通知
  const isReply = !!parentId;
  await createNotification({
    type: isReply ? "NEW_REPLY" : "NEW_COMMENT",
    message: `${name}${isReply ? "回复了" : "评论了"}《${post.title}》`,
    postId: post.id,
    commentId: comment.id,
  });
  sendCommentEmail({
    commenter: name,
    isReply,
    postTitle: post.title,
    postSlug: post.slug,
    commentId: comment.id,
    content,
  });

  // 被回复者邮件通知：父评论者勾选了通知且不是自己回复自己时发送
  if (isReply && parentId && parentEmail && parentEmail !== email) {
    sendReplyEmail({
      toEmail: parentEmail,
      replier: name,
      replyContent: content,
      postTitle: post.title,
      postSlug: post.slug,
      commentId: parentId,
    });
  }

  // 钩子：评论提交成功
  await doAction("after_comment_submit", {
    id: String(comment.id),
    postId: String(comment.postId),
    author: name,
    email,
    content,
    status: comment.status,
    parentId: parentId ? String(parentId) : null,
    ip,
  });

  return NextResponse.json({ ok: true });
}
