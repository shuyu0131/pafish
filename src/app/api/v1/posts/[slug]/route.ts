import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key";

// 开放 API：文章详情（含正文与自定义字段）
// GET /api/v1/posts/[slug]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authError = await requireApiKey(req);
  if (authError) return authError;

  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);

  const post = await prisma.post.findUnique({
    where: { slug, deletedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverUrl: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      viewCount: true,
      likeCount: true,
      favoriteCount: true,
      isPinned: true,
      categoryPinned: true,
      password: true,
      externalUrl: true,
      customFields: true,
      category: { select: { name: true, slug: true } },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
      author: { select: { username: true } },
    },
  });
  if (!post || post.status !== "PUBLISHED" || !post.publishedAt || post.publishedAt > new Date()) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  // 自定义字段 JSON 解析（坏数据容错为空数组）
  let customFields: { key: string; value: string }[] = [];
  if (post.customFields) {
    try {
      const parsed = JSON.parse(post.customFields);
      if (Array.isArray(parsed)) customFields = parsed;
    } catch {
      customFields = [];
    }
  }

  return NextResponse.json({
    id: String(post.id),
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    coverUrl: post.coverUrl,
    publishedAt: post.publishedAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    viewCount: post.viewCount,
    likeCount: post.likeCount,
    favoriteCount: post.favoriteCount,
    isPinned: post.isPinned,
    categoryPinned: post.categoryPinned,
    hasPassword: Boolean(post.password),
    externalUrl: post.externalUrl,
    customFields,
    category: post.category,
    tags: post.tags.map((t) => t.tag),
    author: post.author.username,
  });
}
