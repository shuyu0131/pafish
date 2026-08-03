import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PostCard } from "@/components/post-card";
import { Pagination } from "@/components/pagination";

export const metadata = { title: "搜索" };

const POSTS_PER_PAGE = 10;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page: pageParam } = await searchParams;
  const keyword = q.trim();
  const pageNum = Math.max(1, Number(pageParam) || 1);

  const settings = await getSettings();
  const perPage = Math.min(
    50,
    Math.max(1, Number(settings.posts_per_page || POSTS_PER_PAGE))
  );

  let posts: {
    title: string;
    slug: string;
    excerpt: string;
    coverUrl: string | null;
    publishedAt: Date | null;
    viewCount: number;
    category: { name: string; slug: string } | null;
    tags: { tag: { name: string; slug: string } }[];
    author: { username: string };
  }[] = [];
  let total = 0;

  if (keyword) {
    // MySQL FULLTEXT ngram 中文分词，LIKE 兜底单字/边界情况
    const like = `%${keyword}%`;
    const match = Prisma.sql`
      MATCH(title, excerpt, content) AGAINST (${keyword} IN NATURAL LANGUAGE MODE)
      OR title LIKE ${like} OR excerpt LIKE ${like} OR content LIKE ${like}
    `;
    const [slugRows, totalRows] = await Promise.all([
      prisma.$queryRaw<{ slug: string }[]>(Prisma.sql`
        SELECT slug FROM posts
        WHERE status = 'PUBLISHED' AND deleted_at IS NULL AND (published_at IS NULL OR published_at <= NOW())
          AND (${match})
        ORDER BY published_at DESC
        LIMIT ${perPage} OFFSET ${(pageNum - 1) * perPage}
      `),
      prisma.$queryRaw<{ c: string | number }[]>(Prisma.sql`
        SELECT COUNT(*) AS c FROM posts
        WHERE status = 'PUBLISHED' AND deleted_at IS NULL AND (published_at IS NULL OR published_at <= NOW())
          AND (${match})
      `),
    ]);
    total = Number(totalRows[0]?.c ?? 0);

    const slugs = slugRows.map((r) => r.slug);
    if (slugs.length > 0) {
      posts = await prisma.post.findMany({
        where: { slug: { in: slugs } },
        orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
        select: {
          title: true,
          slug: true,
          excerpt: true,
          coverUrl: true,
          publishedAt: true,
          isPinned: true,
          categoryPinned: true,
          password: true,
          externalUrl: true,
          viewCount: true,
          category: { select: { name: true, slug: true } },
          tags: { select: { tag: { select: { name: true, slug: true } } } },
          author: { select: { username: true } },
        },
      });
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="mx-auto w-full px-6 pb-16 pt-8 lg:px-10 lg:pt-12">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">搜索</p>
        <h1 className="editorial mt-2 text-3xl text-title">
          {keyword ? <>“{keyword}” 的搜索结果</> : "搜索"}
        </h1>
        {keyword && (
          <p className="mt-3 text-xs text-meta">共找到 {total} 篇文章</p>
        )}
      </header>

      {!keyword ? (
        <div className="py-20 text-center">
          <p className="text-lg text-muted">输入关键词开始搜索</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-lg text-muted">没有找到相关文章</p>
        </div>
      ) : (
        <div>
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-10">
          <Pagination
            page={pageNum}
            totalPages={totalPages}
            buildHref={(n) => `/search?q=${encodeURIComponent(keyword)}&page=${n}`}
          />
        </div>
      )}
    </div>
  );
}
