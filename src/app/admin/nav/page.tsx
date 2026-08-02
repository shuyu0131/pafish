import { Menu } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import {
  createNavItem,
  updateNavItem,
  deleteNavItem,
  toggleNavVisible,
  moveNavItem,
} from "../actions";
import { NavItemForm } from "./nav-item-form";
import { NavList } from "./nav-list";

export const metadata = { title: "导航菜单" };

export default async function NavPage() {
  const session = await requireSession();
  const canEdit = canManagePosts(session.role);

  const items = await prisma.navItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">导航菜单</h1>
        <p className="mt-1 text-sm text-muted">配置顶部导航与移动端菜单（共 {items.length} 项）</p>
      </div>

      {canEdit && <NavItemForm onSubmit={createNavItem} />}

      <div className="card divide-y divide-border overflow-hidden">
        {items.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted">
            <Menu size={32} strokeWidth={1.5} />
            <p className="text-sm">暂无菜单项</p>
          </div>
        )}
        {items.map((item, i) => (
          <NavList
            key={String(item.id)}
            item={{
              id: String(item.id),
              label: item.label,
              url: item.url,
              isExternal: item.isExternal,
              visible: item.visible,
            }}
            index={i}
            total={items.length}
            canEdit={canEdit}
            onUpdate={updateNavItem}
            onDelete={deleteNavItem}
            onToggle={toggleNavVisible}
            onMove={moveNavItem}
          />
        ))}
      </div>
    </div>
  );
}
