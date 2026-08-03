import "server-only";
import { prisma } from "@/lib/db";

// 可见组件（前台渲染）
export async function getVisibleWidgets() {
  return prisma.widget.findMany({
    where: { visible: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

// 导航菜单项（前台渲染）
export async function getVisibleNavItems() {
  return prisma.navItem.findMany({
    where: { visible: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}
