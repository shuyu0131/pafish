// 分类层级工具：把扁平分类列表转换为带缩进深度的树形列表
import { prisma } from "@/lib/db";

export interface CategoryTreeItem {
  id: string;
  name: string;
  slug: string;
  depth: number;
}

interface FlatCategory {
  id: bigint;
  name: string;
  slug: string;
  parentId: bigint | null;
  sortOrder: number;
}

/**
 * 按层级排序：顶级分类按 (sortOrder, id) 升序，子分类递归排在其父分类之后。
 * 返回扁平数组 + depth，供下拉框/树形列表使用。
 */
export function buildCategoryTree(
  categories: FlatCategory[]
): CategoryTreeItem[] {
  const byParent = new Map<string, FlatCategory[]>();
  for (const c of categories) {
    const key = c.parentId ? String(c.parentId) : "";
    const list = byParent.get(key) ?? [];
    list.push(c);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id));
  }

  const result: CategoryTreeItem[] = [];
  const walk = (parentKey: string, depth: number) => {
    for (const c of byParent.get(parentKey) ?? []) {
      result.push({ id: String(c.id), name: c.name, slug: c.slug, depth });
      walk(String(c.id), depth + 1);
    }
  };
  walk("", 0);
  return result;
}

// 服务端快捷查询：直接返回带层级深度的分类列表
export async function getCategoryTree(): Promise<CategoryTreeItem[]> {
  const categories = await prisma.category.findMany({
    select: { id: true, name: true, slug: true, parentId: true, sortOrder: true },
  });
  return buildCategoryTree(categories);
}
