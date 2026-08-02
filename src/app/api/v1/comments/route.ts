import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key";

const MAX_PER_PAGE = 100;

// 开放 API：文章评论（仅已通过；含 parentId 便于客户端组回复树）
// GET /api/v1/comments?postId=2&page=1&perPage=50
export async function GET(req: NextRequest) {
  const authError = await requireApiKey(req);
  if (authError) return authError;

  const sp = req.nextUrl.searchParams;
  const postIdRaw = sp.get("postId")?.trim() || "";
  if (!/^\d+$/.test(postIdRaw)) {
    return NextResponse.json({ error: "缺少有效的 postId 参数" }, { status: 400 });
  }
  const postId = BigInt(postIdRaw);
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Number(sp.get("perPage")) || 50));

  const post = await prisma.post.findUnique({
    where: { id: postId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!post || post.status !== "PUBLISHED") {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  const where = { postId, status: "APPROVED" };
  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { createdAt: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        postId: true,
        parentId: true,
        authorName: true,
        content: true,
        createdAt: true,
        isPinned: true,
        likeCount: true,
      },
    }),
    prisma.comment.count({ where }),
  ]);

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: String(c.id),
      postId: String(c.postId),
      parentId: c.parentId ? String(c.parentId) : null,
      authorName: c.authorName,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      isPinned: c.isPinned,
      likeCount: c.likeCount,
    })),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  });
}
