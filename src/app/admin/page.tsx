import Link from "next/link";
import { FileText, MessageSquare, Eye, Clock, PenLine, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { PublishTrendChart, CategoryBarChart } from "@/components/admin/charts";

export const metadata = { title: "工作台" };

export default async function AdminDashboard() {
  const session = await requireSession();

  const [postCount, publishedCount, draftCount, scheduledCount, pendingComments, totalViews] =
    await Promise.all([
      prisma.post.count({ where: { deletedAt: null } }),
      prisma.post.count({ where: { status: "PUBLISHED", deletedAt: null } }),
      prisma.post.count({ where: { status: "DRAFT", deletedAt: null } }),
      prisma.post.count({ where: { status: "SCHEDULED", deletedAt: null } }),
      prisma.comment.count({ where: { status: "PENDING" } }),
      prisma.post.aggregate({ where: { deletedAt: null }, _sum: { viewCount: true } }),
    ]);

  // 近 14 天发文趋势
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 13);
  const recentPosts = await prisma.post.findMany({
    where: { status: "PUBLISHED", publishedAt: { gte: since }, deletedAt: null },
    select: { publishedAt: true },
  });
  const trendDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    return { label: `${d.getMonth() + 1}/${d.getDate()}`, count: 0 };
  });
  for (const p of recentPosts) {
    if (!p.publishedAt) continue;
    const idx = Math.floor(
      (new Date(p.publishedAt).setHours(0, 0, 0, 0) - since.getTime()) / 86400000
    );
    if (idx >= 0 && idx < 14) trendDays[idx].count += 1;
  }

  // 分类分布（文章数 + 浏览量）
  const [catAgg, categories] = await Promise.all([
    prisma.post.groupBy({
      by: ["categoryId"],
      where: { status: "PUBLISHED", deletedAt: null },
      _count: { _all: true },
      _sum: { viewCount: true },
    }),
    prisma.category.findMany({ select: { id: true, name: true } }),
  ]);
  const catName = new Map(categories.map((c) => [String(c.id), c.name]));
  const catRows = catAgg
    .map((r) => ({
      name: r.categoryId ? catName.get(String(r.categoryId)) ?? "未分类" : "未分类",
      count: r._count._all,
      views: Number(r._sum.viewCount ?? 0),
    }))
    .sort((a, b) => b.count - a.count);

  const latestPosts = await prisma.post.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
    },
  });

  const stats = [
    { label: "全部文章", value: postCount, icon: FileText, color: "#4786d6" },
    { label: "已发布", value: publishedCount, icon: Eye, color: "#2f9e63" },
    { label: "草稿", value: draftCount, icon: PenLine, color: "#d9822b" },
    { label: "定时发布", value: scheduledCount, icon: Clock, color: "#8b5cf6" },
    { label: "待审评论", value: pendingComments, icon: MessageSquare, color: "#ca8a04" },
    { label: "总浏览量", value: Number(totalViews._sum.viewCount ?? 0), icon: TrendingUp, color: "#0891b2" },
  ];

  const statusLabel: Record<string, string> = {
    DRAFT: "草稿",
    PUBLISHED: "已发布",
    SCHEDULED: "定时",
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">工作台</h1>
          <p className="mt-1 text-sm text-muted">
            你好，{session.username} · 欢迎回来
          </p>
        </div>
        {canManagePosts(session.role) && (
          <Link href="/admin/posts/new" className="btn btn-primary">
            <PenLine size={15} />
            写文章
          </Link>
        )}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center gap-2">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  color: s.color,
                  backgroundColor: `color-mix(in srgb, ${s.color} 12%, transparent)`,
                }}
              >
                <s.icon size={16} />
              </span>
              <span className="min-w-0 truncate text-xs text-muted">{s.label}</span>
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* 图表 */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-3">
          <h2 className="mb-3 text-sm font-medium text-muted">近 14 天发文趋势</h2>
          <PublishTrendChart days={trendDays} />
        </div>
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-medium text-muted">分类分布（已发布）</h2>
          <CategoryBarChart rows={catRows} />
        </div>
      </div>

      {/* 最近更新 */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted">最近更新</h2>
        <div className="card divide-y divide-border overflow-hidden">
          {latestPosts.length === 0 && (
            <p className="p-6 text-sm text-muted">还没有文章，点击右上角「写文章」开始创作。</p>
          )}
          {latestPosts.map((p) => (
            <Link
              key={String(p.id)}
              href={`/admin/posts/${p.id}/edit`}
              className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-accent-soft"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  更新于 {formatDateTime(p.updatedAt)}
                </p>
              </div>
              <span
                className={
                  p.status === "PUBLISHED"
                    ? "badge badge-success"
                    : p.status === "SCHEDULED"
                      ? "badge badge-warning"
                      : "badge"
                }
              >
                {statusLabel[p.status]}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
