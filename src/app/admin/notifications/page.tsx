import Link from "next/link";
import { Bell, CheckCheck, MessageSquare, CornerDownRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { markAllNotificationsRead } from "../actions";
import { ReadAllButton } from "./read-all-button";

export const metadata = { title: "通知" };

const PAGE_SIZE = 20;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireSession();
  const canEdit = canManagePosts(session.role);
  const { page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      orderBy: [{ read: "asc" }, { createdAt: "desc" }],
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { post: { select: { slug: true, title: true } } },
    }),
    prisma.notification.count(),
    prisma.notification.count({ where: { read: false } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">通知</h1>
          <p className="mt-1 text-sm text-muted">
            {unreadCount > 0 ? `${unreadCount} 条未读` : "没有未读通知"}
          </p>
        </div>
        {canEdit && unreadCount > 0 && <ReadAllButton action={markAllNotificationsRead} />}
      </div>

      <div className="card divide-y divide-border overflow-hidden">
        {notifications.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted">
            <Bell size={32} strokeWidth={1.5} />
            <p className="text-sm">暂无通知，新评论/新回复会显示在这里</p>
          </div>
        )}
        {notifications.map((n) => (
          <div
            key={String(n.id)}
            className={`flex items-start justify-between gap-4 px-5 py-4 ${
              !n.read ? "bg-accent-soft/40" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {!n.read && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="未读" />
                )}
                {n.type === "NEW_REPLY" ? (
                  <CornerDownRight size={14} className="shrink-0 text-accent" />
                ) : (
                  <MessageSquare size={14} className="shrink-0 text-accent" />
                )}
                <span className="font-medium">
                  {n.type === "NEW_REPLY" ? "新回复" : "新评论"}
                </span>
                <span className="text-xs text-muted">{formatDateTime(n.createdAt)}</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed">{n.message}</p>
              {n.post && (
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/post/${n.post.slug}`}
                    target="_blank"
                    className="text-xs text-accent hover:underline"
                  >
                    查看《{n.post.title}》→
                  </Link>
                  <Link
                    href="/admin/comments?status=PENDING"
                    className="text-xs text-muted hover:text-accent hover:underline"
                  >
                    去审核 →
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={`/admin/notifications?page=${n}`}
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
