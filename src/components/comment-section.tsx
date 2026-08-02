import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/utils";
import { avatarSrc } from "@/lib/avatar";
import { CommentForm } from "./comment-form";
import { CommentThread, type CommentNode } from "./comment-thread";

// 每页顶层评论数（回复随所在顶层评论整棵加载）
const PAGE_SIZE = 20;

const COMMENT_SELECT = {
  id: true,
  authorName: true,
  authorEmail: true,
  content: true,
  createdAt: true,
  parentId: true,
  isPinned: true,
  likeCount: true,
  user: { select: { avatarUrl: true, nickname: true } },
} as const;

export async function CommentSection({
  postId,
  needReview,
  page = 1,
}: {
  postId: string;
  needReview: boolean;
  page?: number;
}) {
  const postIdBig = BigInt(postId);

  // 登录用户：评论自动使用登录身份（昵称优先）；未登录游客按评论验证码开关显示图形验证码
  const [session, settings] = await Promise.all([getSession(), getSettings()]);
  let user: { username: string; nickname: string | null } | null = null;
  if (session) {
    const u = await prisma.user.findUnique({
      where: { id: BigInt(session.id) },
      select: { username: true, nickname: true },
    });
    user = u;
  }
  const captchaEnabled = settings.comments_captcha_enabled !== "false";

  // 顶层评论分页（置顶优先，其余按时间正序）
  const [topCount, total, topComments] = await Promise.all([
    prisma.comment.count({
      where: { postId: postIdBig, status: "APPROVED", parentId: null },
    }),
    prisma.comment.count({ where: { postId: postIdBig, status: "APPROVED" } }),
    prisma.comment.findMany({
      where: { postId: postIdBig, status: "APPROVED", parentId: null },
      orderBy: [{ isPinned: "desc" }, { createdAt: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: COMMENT_SELECT,
    }),
  ]);

  // 递归加载整棵回复树（最多 5 层，防深链滥用）
  const all = [...topComments];
  let batch = topComments.map((c) => c.id);
  for (let depth = 0; depth < 5; depth++) {
    const kids = await prisma.comment.findMany({
      where: {
        postId: postIdBig,
        status: "APPROVED",
        parentId: { in: batch },
      },
      orderBy: { createdAt: "asc" },
      select: COMMENT_SELECT,
    });
    if (kids.length === 0) break;
    all.push(...kids);
    batch = kids.map((k) => k.id);
  }

  // 当前浏览器已点赞的评论（cookie 记录，用于回显点赞状态）
  const cookieStore = await cookies();
  const likedSet = new Set(
    (cookieStore.get("liked_comments")?.value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  // 构建回复树：parentId 找不到父节点的（父未通过/被删）按顶层评论展示，不丢评论
  const byId = new Map<string, CommentNode>();
  for (const c of all) {
    byId.set(String(c.id), {
      id: String(c.id),
      authorName: c.user?.nickname || c.authorName,
      avatar: avatarSrc(c.user?.avatarUrl, c.authorEmail, 80),
      content: c.content,
      createdAtLabel: formatDate(c.createdAt, "yyyy-MM-dd HH:mm"),
      isPinned: c.isPinned,
      likeCount: c.likeCount,
      liked: likedSet.has(String(c.id)),
      replies: [],
    });
  }
  const roots: CommentNode[] = [];
  for (const c of all) {
    const node = byId.get(String(c.id))!;
    const parent = c.parentId ? byId.get(String(c.parentId)) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }

  const totalPages = Math.max(1, Math.ceil(topCount / PAGE_SIZE));

  return (
    <section id="comments" className="mt-16 border-t border-border pt-10">
      <h2 className="text-lg font-semibold text-title">
        评论 <span className="text-sm font-normal text-meta">({total})</span>
      </h2>

      <CommentForm
        postId={postId}
        needReview={needReview}
        user={user}
        captchaEnabled={captchaEnabled}
      />

      <CommentThread
        comments={roots}
        postId={postId}
        needReview={needReview}
        user={user}
        captchaEnabled={captchaEnabled}
      />

      {/* 评论分页（按顶层评论计数） */}
      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-1.5">
          {page > 1 && (
            <Link
              href={`?cpage=${page - 1}#comments`}
              className="btn btn-ghost !px-3 !py-1.5 !text-sm"
            >
              上一页
            </Link>
          )}
          <span className="px-2 text-sm text-muted">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`?cpage=${page + 1}#comments`}
              className="btn btn-ghost !px-3 !py-1.5 !text-sm"
            >
              下一页
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}
