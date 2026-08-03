import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

// 相关推荐：同分类或共享标签的文章（排除当前篇），按置顶 + 发布时间排序
export async function RelatedPosts({
  postId,
  categoryId,
  tagIds,
}: {
  postId: bigint;
  categoryId: bigint | null;
  tagIds: bigint[];
}) {
  if (!categoryId && tagIds.length === 0) return null;

  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { lte: new Date() },
      deletedAt: null,
      id: { not: postId },
      OR: [
        ...(categoryId ? [{ categoryId }] : []),
        ...(tagIds.length > 0 ? [{ tags: { some: { tagId: { in: tagIds } } } }] : []),
      ],
    },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
    take: 5,
    select: { title: true, slug: true, publishedAt: true },
  });

  if (posts.length === 0) return null;

  return (
    <section className="mt-14 border-t border-border pt-8">
      <h2 className="text-lg font-semibold text-title">相关推荐</h2>
      <ul className="mt-5 space-y-3">
        {posts.map((p) => (
          <li key={p.slug} className="flex items-baseline justify-between gap-4">
            <Link
              href={`/post/${p.slug}`}
              className="min-w-0 truncate text-sm text-foreground transition-colors hover:text-accent"
            >
              {p.title}
            </Link>
            <span className="shrink-0 text-xs text-meta">
              {formatDate(p.publishedAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
