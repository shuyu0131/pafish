import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import { getCategoryTree } from "@/lib/category-tree";
import { PostEditor } from "@/components/admin/post-editor";

export const metadata = { title: "写文章" };

export default async function NewPostPage() {
  const session = await requireSession();
  if (!canManagePosts(session.role)) redirect("/admin");

  const [categories, tags] = await Promise.all([
    getCategoryTree(),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">写文章</h1>
      <PostEditor
        mode="create"
        categories={categories}
        tags={tags.map((t) => ({ id: String(t.id), name: t.name }))}
      />
    </div>
  );
}
