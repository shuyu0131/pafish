import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "文章归档",
  description: "按月份归档浏览全部文章",
};

// 按年月分组的归档页
export default async function ArchivesPage() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED", publishedAt: { lte: new Date() }, deletedAt: null },
    orderBy: { publishedAt: "desc" },
    select: { title: true, slug: true, publishedAt: true },
  });

  // 按 YYYY年MM月 分组
  const groups: { month: string; posts: typeof posts }[] = [];
  for (const p of posts) {
    if (!p.publishedAt) continue;
    const month = formatDate(p.publishedAt, "yyyy年MM月");
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.posts.push(p);
    else groups.push({ month, posts: [p] });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-16 pt-8 lg:px-10 lg:pt-12">
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">文章归档</h1>
        <p className="mt-3 text-xs text-muted">共 {posts.length} 篇文章</p>
      </header>

      {groups.length === 0 ? (
        <p className="py-20 text-center text-muted">还没有文章</p>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.month}>
              <h2 className="mb-3 text-sm font-semibold text-muted">
                {g.month}
                <span className="ml-2 font-normal">({g.posts.length})</span>
              </h2>
              <ul className="divide-y divide-border">
                {g.posts.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/post/${p.slug}`}
                      className="group flex items-baseline justify-between gap-4 py-3"
                    >
                      <span className="text-sm transition-colors group-hover:text-accent">
                        {p.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {formatDate(p.publishedAt!, "MM-dd")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
