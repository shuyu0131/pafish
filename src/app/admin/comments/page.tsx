import Link from "next/link";
import { MessageSquare, Pin } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManagePosts, COMMENT_STATUS_LABEL } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { deleteComment } from "../actions";
import { DeleteButton } from "../delete-button";
import { CommentActionButton } from "./comment-actions";
import { DeleteByIpButton, PinButton } from "./pin-ip-actions";
import { ReplyButton, BlockIpButton } from "./reply-block-actions";

export const metadata = { title: "评论审核" };

const PAGE_SIZE = 20;

export default async function CommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await requireSession();
  const canEdit = canManagePosts(session.role);
  const { status, page } = await searchParams;

  const statusFilter = ["PENDING", "APPROVED", "SPAM", "TRASH"].includes(status ?? "")
    ? status
    : "PENDING"; // 默认看待审核
  const pageNum = Math.max(1, Number(page) || 1);

  const where = { status: statusFilter };
  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        post: { select: { title: true, slug: true } },
        parent: { select: { authorName: true } },
      },
    }),
    prisma.comment.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const tabs = [
    { key: "PENDING", label: "待审核" },
    { key: "APPROVED", label: "已通过" },
    { key: "SPAM", label: "垃圾" },
    { key: "TRASH", label: "已删除" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">评论审核</h1>
        <p className="mt-1 text-sm text-muted">
          {statusFilter === "PENDING" && total > 0
            ? `${total} 条评论待审核`
            : `共 ${total} 条评论`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/comments?status=${t.key}`}
            className={
              statusFilter === t.key
                ? "btn btn-primary !py-1.5 !text-xs"
                : "btn btn-outline !py-1.5 !text-xs"
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="card divide-y divide-border overflow-hidden">
        {comments.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted">
            <MessageSquare size={32} strokeWidth={1.5} />
            <p className="text-sm">这里没有评论</p>
          </div>
        )}
        {comments.map((c) => (
          <div key={String(c.id)} className="px-5 py-4">
            {/* 移动端上下堆叠（操作按钮多，横排会挤压内容列），桌面端保持横排 */}
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{c.authorName}</span>
                  {c.isPinned && (
                    <span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
                      <Pin size={9} />
                      置顶
                    </span>
                  )}
                  <span className="text-xs text-muted">
                    {formatDateTime(c.createdAt)} · 评论于
                  </span>
                  <Link
                    href={`/post/${c.post.slug}`}
                    target="_blank"
                    className="text-xs text-accent hover:underline"
                  >
                    《{c.post.title}》
                  </Link>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                  {c.parent && (
                    <span className="mr-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-xs text-accent">
                      回复 @{c.parent.authorName}
                    </span>
                  )}
                  {c.content}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                  <span>{c.authorEmail}</span>
                  {c.ip && <span className="font-mono">{c.ip}</span>}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {canEdit && (
                  <>
                    <ReplyButton id={String(c.id)} commenter={c.authorName} />
                    {c.status !== "APPROVED" && (
                      <CommentActionButton
                        id={String(c.id)}
                        status="APPROVED"
                        label="通过"
                      />
                    )}
                    {c.status !== "SPAM" && (
                      <CommentActionButton
                        id={String(c.id)}
                        status="SPAM"
                        label="垃圾"
                        variant="outline"
                      />
                    )}
                    <PinButton id={String(c.id)} pinned={c.isPinned} />
                    {c.ip && (
                      <>
                        <DeleteByIpButton ip={c.ip} />
                        <BlockIpButton ip={c.ip} />
                      </>
                    )}
                    <DeleteButton
                      id={String(c.id)}
                      action={deleteComment}
                      confirmText="确定删除这条评论？"
                    />
                  </>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              当前状态：{COMMENT_STATUS_LABEL[c.status]}
            </p>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={`/admin/comments?status=${statusFilter}&page=${n}`}
              className={
                n === pageNum
                  ? "btn btn-primary !h-8 !w-8 !p-0 !text-xs"
                  : "btn btn-outline !h-8 !w-8 !p-0 !text-xs"
              }
            >
              {n}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
