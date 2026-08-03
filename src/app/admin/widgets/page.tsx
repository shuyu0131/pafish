import { LayoutTemplate } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import {
  createWidget,
  updateWidget,
  deleteWidget,
  toggleWidgetVisible,
  moveWidget,
} from "../actions";
import { WidgetForm } from "./widget-form";
import { WidgetList } from "./widget-list";

export const metadata = { title: "侧边栏组件" };

export default async function WidgetsPage() {
  const session = await requireSession();
  const canEdit = canManagePosts(session.role);

  const widgets = await prisma.widget.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">侧边栏组件</h1>
        <p className="mt-1 text-sm text-muted">配置前台左侧栏展示的组件（共 {widgets.length} 个）</p>
      </div>

      {canEdit && <WidgetForm onSubmit={createWidget} />}

      <div className="card divide-y divide-border overflow-hidden">
        {widgets.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted">
            <LayoutTemplate size={32} strokeWidth={1.5} />
            <p className="text-sm">暂无组件，添加后前台左侧栏才会显示</p>
          </div>
        )}
        {widgets.map((w, i) => (
          <WidgetList
            key={String(w.id)}
            widget={{
              id: String(w.id),
              type: w.type,
              title: w.title ?? "",
              content: w.content ?? "",
              visible: w.visible,
            }}
            index={i}
            total={widgets.length}
            canEdit={canEdit}
            onUpdate={updateWidget}
            onDelete={deleteWidget}
            onToggle={toggleWidgetVisible}
            onMove={moveWidget}
          />
        ))}
      </div>
    </div>
  );
}
