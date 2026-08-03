import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PostCard } from "@/components/post-card";
import { Pagination } from "@/components/pagination";

const POSTS_PER_PAGE = 10;

// 动态 SEO：标签名进入标题与 OG 标签
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const tag = await prisma.tag.findUnique({
    where: { slug },
    select: { name: true },
  });
  if (!tag) return { title: "标签" };
  const description = `「${tag.name}」标签下的文章列表`;
  return {
    title: tag.name,
    description,
    openGraph: { title: tag.name, description },
  };
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug: rawSlug } = await params;
  // Next.js App Router 对路径参数不做 URL 解码，中文 slug 需手动解码
  const slug = decodeURIComponent(rawSlug);
  const { page: pageParam } = await searchParams;
  const pageNum = Math.max(1, Number(pageParam) || 1);

  const tag = await prisma.tag.findUnique({
    where: { slug },
    select: { name: true, slug: true },
  });
  if (!tag) notFound();

  const settings = await getSettings();
  const perPage = Math.min(
    50,
    Math.max(1, Number(settings.posts_per_page || POSTS_PER_PAGE))
  );

  const publishedWhere = { status: "PUBLISHED", publishedAt: { lte: new Date() }, deletedAt: null };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { ...publishedWhere, tags: { some: { tag: { slug } } } },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      skip: (pageNum - 1) * perPage,
      take: perPage,
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
    }),
    prisma.post.count({
      where: { ...publishedWhere, tags: { some: { tag: { slug } } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="mx-auto w-full px-6 pb-16 pt-8 lg:px-10 lg:pt-12">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">标签</p>
        <h1 className="editorial mt-2 text-3xl text-title">{tag.name}</h1>
        <p className="mt-3 text-xs text-meta">共 {total} 篇文章</p>
      </header>

      {posts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-lg text-muted">该标签下还没有文章</p>
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
            buildHref={(n) => `/tag/${slug}?page=${n}`}
          />
        </div>
      )}
    </div>
  );
}
