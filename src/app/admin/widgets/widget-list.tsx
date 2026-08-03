"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowUp, ArrowDown, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { WIDGET_TYPE_LABEL, WidgetType } from "@/lib/widget-constants";
import { WidgetForm } from "./widget-form";

interface WidgetRow {
  id: string;
  type: string;
  title: string;
  content: string;
  visible: boolean;
}

export function WidgetList({
  widget,
  index,
  total,
  canEdit,
  onUpdate,
  onDelete,
  onToggle,
  onMove,
}: {
  widget: WidgetRow;
  index: number;
  total: number;
  canEdit: boolean;
  onUpdate: (id: bigint, data: { type: WidgetType; title: string; content: string }) => Promise<unknown>;
  onDelete: (id: bigint) => Promise<unknown>;
  onToggle: (id: bigint) => Promise<unknown>;
  onMove: (id: bigint, dir: "up" | "down") => Promise<unknown>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  function run(fn: () => Promise<unknown>, reset = true) {
    setError("");
    startTransition(async () => {
      try {
        await fn();
        if (reset) {
          setEditing(false);
          setConfirmDelete(false);
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  const typeLabel = WIDGET_TYPE_LABEL[widget.type as keyof typeof WIDGET_TYPE_LABEL] ?? widget.type;

  return (
    <div className="px-5 py-4">
      {/* 移动端上下堆叠，桌面端横排 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <p className="text-sm font-medium">
              {widget.title?.trim() || typeLabel}
              {!widget.title?.trim() && <span className="ml-1.5 text-xs text-muted">（{typeLabel}）</span>}
            </p>
            <span className="badge badge-accent">{typeLabel}</span>
            {!widget.visible && <span className="badge badge-danger">已隐藏</span>}
          </div>
          {widget.type === "custom" && widget.content && (
            <p className="mt-1 truncate text-xs text-muted">{widget.content}</p>
          )}
        </div>

        {canEdit && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <button
              className="btn btn-ghost !p-1.5"
              disabled={pending || index === 0}
              onClick={() => run(() => onMove(BigInt(widget.id), "up"))}
              title="上移"
            >
              <ArrowUp size={14} />
            </button>
            <button
              className="btn btn-ghost !p-1.5"
              disabled={pending || index === total - 1}
              onClick={() => run(() => onMove(BigInt(widget.id), "down"))}
              title="下移"
            >
              <ArrowDown size={14} />
            </button>
            <button
              className="btn btn-ghost !p-1.5"
              disabled={pending}
              onClick={() => run(() => onToggle(BigInt(widget.id)))}
              title={widget.visible ? "隐藏" : "显示"}
            >
              {widget.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button
              className="btn btn-ghost !p-1.5"
              disabled={pending}
              onClick={() => setEditing(!editing)}
              title="编辑"
            >
              <Pencil size={14} />
            </button>
            <button
              className={confirmDelete ? "btn btn-danger !p-1.5" : "btn btn-ghost !p-1.5"}
              disabled={pending}
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                } else {
                  run(() => onDelete(BigInt(widget.id)));
                }
              }}
              title={confirmDelete ? "确认删除？" : "删除"}
            >
              <Trash2 size={14} />
              {confirmDelete && <span className="text-xs">确认？</span>}
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="mt-4">
          <WidgetForm
            initial={{ id: widget.id, type: widget.type, title: widget.title ?? "", content: widget.content ?? "" }}
            onSubmit={(data) => onUpdate(BigInt(widget.id), data)}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
