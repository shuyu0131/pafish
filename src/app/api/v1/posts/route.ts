import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key";

const MAX_PER_PAGE = 50;
const DEFAULT_PER_PAGE = 10;

// 开放 API：文章列表（分页 + 分类/标签/关键词过滤）
// GET /api/v1/posts?page=1&perPage=10&category=tech&tag=nextjs&q=关键词
export async function GET(req: NextRequest) {
  const authError = await requireApiKey(req);
  if (authError) return authError;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Number(sp.get("perPage")) || DEFAULT_PER_PAGE));
  const categorySlug = sp.get("category")?.trim() || "";
  const tagSlug = sp.get("tag")?.trim() || "";
  const q = sp.get("q")?.trim() || "";

  const baseWhere: Record<string, unknown> = {
    status: "PUBLISHED",
    publishedAt: { lte: new Date() },
    deletedAt: null,
  };
  if (categorySlug) {
    const category = await prisma.category.findUnique({
      where: { slug: categorySlug },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: "分类不存在" }, { status: 404 });
    }
    // 与前台一致：包含子分类的文章
    const ids: bigint[] = [category.id];
    let frontier = [category.id];
    while (frontier.length > 0) {
      const kids = await prisma.category.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      frontier = kids.map((k) => k.id);
      ids.push(...frontier);
    }
    baseWhere.categoryId = { in: ids };
  }
  if (tagSlug) {
    baseWhere.tags = { some: { tag: { slug: tagSlug } } };
  }
  if (q) {
    baseWhere.OR = [{ title: { contains: q } }, { content: { contains: q } }];
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: baseWhere,
      orderBy: [{ isPinned: "desc" }, { categoryPinned: "desc" }, { publishedAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverUrl: true,
        publishedAt: true,
        viewCount: true,
        likeCount: true,
        favoriteCount: true,
        isPinned: true,
        categoryPinned: true,
        password: true,
        externalUrl: true,
        category: { select: { name: true, slug: true } },
        tags: { select: { tag: { select: { name: true, slug: true } } } },
        author: { select: { username: true } },
      },
    }),
    prisma.post.count({ where: baseWhere }),
  ]);

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: String(p.id),
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      coverUrl: p.coverUrl,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      viewCount: p.viewCount,
      likeCount: p.likeCount,
      favoriteCount: p.favoriteCount,
      isPinned: p.isPinned,
      categoryPinned: p.categoryPinned,
      hasPassword: Boolean(p.password),
      externalUrl: p.externalUrl,
      category: p.category,
      tags: p.tags.map((t) => t.tag),
      author: p.author.username,
    })),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  });
}
