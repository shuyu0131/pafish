import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import { getCategoryTree } from "@/lib/category-tree";
import { PostEditor } from "@/components/admin/post-editor";

export const metadata = { title: "编辑文章" };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!canManagePosts(session.role)) redirect("/admin");

  const { id } = await params;
  const postId = BigInt(id);

  const [post, categories, tags] = await Promise.all([
    prisma.post.findUnique({
      where: { id: postId },
      include: {
        tags: { select: { tagId: true } },
      },
    }),
    getCategoryTree(),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!post) notFound();

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">编辑文章</h1>
      <PostEditor
        mode="edit"
        postId={id}
        initial={{
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          coverUrl: post.coverUrl,
          categoryId: post.categoryId ? String(post.categoryId) : null,
          tagIds: post.tags.map((t) => String(t.tagId)),
          isPinned: post.isPinned,
          status: post.status,
          publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
          hasPassword: Boolean(post.password),
          externalUrl: post.externalUrl,
          categoryPinned: post.categoryPinned,
          customFields,
        }}
        categories={categories}
        tags={tags.map((t) => ({ id: String(t.id), name: t.name }))}
      />
    </div>
  );
}
