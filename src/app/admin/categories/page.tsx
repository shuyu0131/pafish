import { ArrowDown, ArrowUp, FolderOpen, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import { buildCategoryTree } from "@/lib/category-tree";
import {
  createCategory,
  deleteCategory,
  moveCategory,
  updateCategory,
} from "../actions";
import { CategoryForm } from "./category-form";
import { DeleteButton } from "../delete-button";
import { MoveButton } from "../move-button";

export const metadata = { title: "分类管理" };

type CatWithCount = {
  id: bigint;
  name: string;
  slug: string;
  description: string | null;
  parentId: bigint | null;
  sortOrder: number;
  _count: { posts: number };
};

export default async function CategoriesPage() {
  const session = await requireSession();
  const canEdit = canManagePosts(session.role);

  const categories = await prisma.category.findMany({
    include: { _count: { select: { posts: true } } },
  });

  // 扁平树列表（供下拉框使用）
  const tree = buildCategoryTree(categories);

  // 嵌套行（供列表渲染）
  const byParent = new Map<string, CatWithCount[]>();
  for (const c of categories) {
    const key = c.parentId ? String(c.parentId) : "";
    (byParent.get(key) ?? byParent.set(key, []).get(key)!).push(c);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id));
  }
  const rows: { c: CatWithCount; depth: number; isFirst: boolean; isLast: boolean }[] = [];
  const walk = (list: CatWithCount[], depth: number) => {
    list.forEach((c, i) => {
      rows.push({ c, depth, isFirst: i === 0, isLast: i === list.length - 1 });
      walk(byParent.get(String(c.id)) ?? [], depth + 1);
    });
  };
  walk(byParent.get("") ?? [], 0);

  // 每个分类的自身+后代 id（编辑时禁止选为父分类）
  const disabledMap = new Map<string, string[]>();
  const collectDesc = (id: bigint): string[] => {
    const kids = byParent.get(String(id)) ?? [];
    return [String(id), ...kids.flatMap((k) => collectDesc(k.id))];
  };
  for (const c of categories) {
    disabledMap.set(String(c.id), collectDesc(c.id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">分类管理</h1>
        <p className="mt-1 text-sm text-muted">
          共 {categories.length} 个分类，支持父子层级与排序（上移/下移调整同级顺序）
        </p>
      </div>

      {canEdit && (
        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-medium">
            <Plus size={15} />
            新建分类
          </h2>
          <CategoryForm onSubmit={createCategory} categories={tree} />
        </div>
      )}

      <div className="card divide-y divide-border overflow-hidden">
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted">
            <FolderOpen size={32} strokeWidth={1.5} />
            <p className="text-sm">还没有分类</p>
          </div>
        )}
        {rows.map(({ c, depth, isFirst, isLast }) => (
          <div
            key={String(c.id)}
            className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-4"
            style={{ paddingLeft: 20 + depth * 24 }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                {depth > 0 && (
                  <span className="text-xs text-muted">└</span>
                )}
                <p className="text-sm font-medium">{c.name}</p>
                <span className="badge">{c._count.posts} 篇</span>
              </div>
              {c.description && (
                <p className="mt-1 truncate text-xs text-muted">{c.description}</p>
              )}
              <p className="mt-0.5 text-xs text-muted">/category/{c.slug}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {canEdit && (
                <>
                  <MoveButton
                    action={moveCategory.bind(null, c.id, "up")}
                    disabled={isFirst}
                    title="上移"
                  >
                    <ArrowUp size={14} />
                  </MoveButton>
                  <MoveButton
                    action={moveCategory.bind(null, c.id, "down")}
                    disabled={isLast}
                    title="下移"
                  >
                    <ArrowDown size={14} />
                  </MoveButton>
                </>
              )}
              <CategoryForm
                initial={{
                  name: c.name,
                  slug: c.slug,
                  description: c.description ?? "",
                  parentId: c.parentId ? String(c.parentId) : null,
                }}
                categories={tree}
                disabledParentIds={disabledMap.get(String(c.id)) ?? []}
                onSubmit={updateCategory.bind(null, c.id)}
                triggerLabel="编辑"
                submitLabel="保存"
              />
              <DeleteButton
                id={String(c.id)}
                action={deleteCategory}
                confirmText={`删除分类「${c.name}」？其子分类会提升为顶级分类，该分类下的文章会变为未分类。`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
