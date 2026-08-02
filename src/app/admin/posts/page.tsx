import Link from "next/link";
import { PenLine, FileUp } from "lucide-react";
import { cookies } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { getCategoryTree } from "@/lib/category-tree";
import { PostsManager } from "@/components/admin/posts-manager";

export const metadata = { title: "文章管理" };

const PER_PAGE_OPTIONS = [10, 20, 50];

// 排序方式：最新发布 / 最近更新 / 置顶优先 / 浏览最多 / 评论最多
const SORTS: Record<
  string,
  Prisma.PostOrderByWithRelationInput | Prisma.PostOrderByWithRelationInput[]
> = {
  latest: { publishedAt: "desc" },
  updated: { updatedAt: "desc" },
  pinned: [{ isPinned: "desc" }, { publishedAt: "desc" }],
  views: { viewCount: "desc" },
  comments: { comments: { _count: "desc" } },
};

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession();
  const canEdit = canManagePosts(session.role);
  const sp = await searchParams;

  // status=trash 表示回收站（软删除），其余按状态筛选；正常列表排除回收站
  const isTrash = sp.status === "trash";
  const status = !isTrash &&
    ["PUBLISHED", "DRAFT", "SCHEDULED"].includes(sp.status ?? "")
    ? sp.status
    : undefined;
  const category = sp.category ?? "";
  const q = sp.q?.trim() ?? "";
  const sort = SORTS[sp.sort ?? ""] ? (sp.sort as string) : "latest";
  const pageNum = Math.max(1, Number(sp.page) || 1);

  // 每页条数：URL 参数优先，其次 cookie 里记住的偏好，默认 20
  const perRaw = Number(sp.per) || 0;
  const cookieStore = await cookies();
  const perPref = Number(cookieStore.get("admin_posts_per_page")?.value) || 0;
  const per = PER_PAGE_OPTIONS.includes(perRaw)
    ? perRaw
    : PER_PAGE_OPTIONS.includes(perPref)
      ? perPref
      : 20;

  const where = {
    // 回收站只看已软删除的；正常列表排除回收站
    ...(isTrash ? { deletedAt: { not: null } } : { deletedAt: null }),
    ...(status ? { status } : {}),
    ...(category === "none"
      ? { categoryId: null }
      : /^\d+$/.test(category)
        ? { categoryId: BigInt(category) }
        : {}),
    ...(q
      ? { OR: [{ title: { contains: q } }, { content: { contains: q } }] }
      : {}),
  };

  const [posts, total, byStatus, categories, trashCount] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: SORTS[sort] as never,
      skip: (pageNum - 1) * per,
      take: per,
      include: {
        category: { select: { name: true } },
        author: { select: { username: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.post.count({ where }),
    prisma.post.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: true,
    }),
    getCategoryTree(),
    prisma.post.count({ where: { deletedAt: { not: null } } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / per));
  const countOf = (s: string) =>
    byStatus.find((b) => b.status === s)?._count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">文章管理</h1>
          <p className="mt-1 text-sm text-muted">
            共 {total} 篇
            {q && ` · 搜索“${q}”`}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/posts/import" className="btn btn-outline">
              <FileUp size={15} />
              导入 Markdown
            </Link>
            <Link href="/admin/posts/new" className="btn btn-primary">
              <PenLine size={15} />
              写文章
            </Link>
          </div>
        )}
      </div>

      <PostsManager
        posts={posts.map((p) => ({
          id: String(p.id),
          title: p.title,
          status: p.status,
          slug: p.slug,
          categoryName: p.category?.name ?? null,
          authorName: p.author.username,
          viewCount: p.viewCount,
          commentCount: p._count.comments,
          isPinned: p.isPinned,
          categoryPinned: p.categoryPinned,
          hasPassword: Boolean(p.password),
          externalUrl: p.externalUrl,
          updatedAtLabel: formatDateTime(p.updatedAt),
          publishedAtLabel: p.publishedAt
            ? formatDateTime(p.publishedAt)
            : null,
          deletedAtLabel: p.deletedAt ? formatDateTime(p.deletedAt) : null,
        }))}
        total={total}
        totalPages={totalPages}
        counts={{
          PUBLISHED: countOf("PUBLISHED"),
          DRAFT: countOf("DRAFT"),
          SCHEDULED: countOf("SCHEDULED"),
          TRASH: trashCount,
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.name, depth: c.depth }))}
        canEdit={canEdit}
        isTrash={isTrash}
        params={{
          status: sp.status ?? "",
          q,
          category,
          sort,
          per: String(per),
          page: String(pageNum),
        }}
      />
    </div>
  );
}
