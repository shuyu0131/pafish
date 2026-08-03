import { Tags as TagsIcon, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import { createTag, deleteTag, updateTag } from "../actions";
import { TagForm } from "./tag-form";
import { DeleteButton } from "../delete-button";

export const metadata = { title: "标签管理" };

export default async function TagsPage() {
  const session = await requireSession();
  const canEdit = canManagePosts(session.role);

  const tags = await prisma.tag.findMany({
    include: { _count: { select: { posts: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">标签管理</h1>
        <p className="mt-1 text-sm text-muted">共 {tags.length} 个标签，别名冲突时自动追加 -N 后缀</p>
      </div>

      {canEdit && (
        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-medium">
            <Plus size={15} />
            新建标签
          </h2>
          <TagForm onSubmit={createTag} />
        </div>
      )}

      <div className="card divide-y divide-border overflow-hidden">
        {tags.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted">
            <TagsIcon size={32} strokeWidth={1.5} />
            <p className="text-sm">还没有标签</p>
          </div>
        )}
        {tags.map((t) => (
          <div key={String(t.id)} className="flex flex-col gap-3 px-5 py-3.5 md:flex-row md:items-center md:justify-between md:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-medium">{t.name}</span>
                <span className="badge">{t._count.posts} 篇</span>
              </div>
              <p className="mt-0.5 text-xs text-muted">/tag/{t.slug}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {canEdit && (
                <>
                  <TagForm
                    initial={{ name: t.name, slug: t.slug }}
                    onSubmit={updateTag.bind(null, t.id)}
                    triggerLabel="编辑"
                    submitLabel="保存"
                  />
                  <DeleteButton
                    id={String(t.id)}
                    action={deleteTag}
                    confirmText={`删除标签「${t.name}」？`}
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
