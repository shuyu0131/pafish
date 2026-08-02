import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key";

// 开放 API：标签列表（含文章数）
// GET /api/v1/tags
export async function GET(req: NextRequest) {
  const authError = await requireApiKey(req);
  if (authError) return authError;

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { posts: true } },
    },
  });

  return NextResponse.json({
    tags: tags.map((t) => ({
      id: String(t.id),
      name: t.name,
      slug: t.slug,
      postCount: t._count.posts,
    })),
  });
}
