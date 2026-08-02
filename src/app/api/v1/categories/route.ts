import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key";

// 开放 API：分类列表（含文章数，含层级 parentId）
// GET /api/v1/categories
export async function GET(req: NextRequest) {
  const authError = await requireApiKey(req);
  if (authError) return authError;

  const categories = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      parentId: true,
      _count: { select: { posts: true } },
    },
  });

  return NextResponse.json({
    categories: categories.map((c) => ({
      id: String(c.id),
      name: c.name,
      slug: c.slug,
      description: c.description,
      parentId: c.parentId ? String(c.parentId) : null,
      postCount: c._count.posts,
    })),
  });
}
