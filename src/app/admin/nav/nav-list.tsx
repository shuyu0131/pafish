"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowUp, ArrowDown, Eye, EyeOff, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { NavItemForm } from "./nav-item-form";

interface NavRow {
  id: string;
  label: string;
  url: string;
  isExternal: boolean;
  visible: boolean;
}

export function NavList({
  item,
  index,
  total,
  canEdit,
  onUpdate,
  onDelete,
  onToggle,
  onMove,
}: {
  item: NavRow;
  index: number;
  total: number;
  canEdit: boolean;
  onUpdate: (id: bigint, data: { label: string; url: string; isExternal: boolean }) => Promise<unknown>;
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

  return (
    <div className="px-5 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <p className="text-sm font-medium">{item.label}</p>
            {!item.visible && <span className="badge badge-danger">已隐藏</span>}
            {item.isExternal && (
              <span className="badge">
                <ExternalLink size={10} />
                外部
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-muted">
            <Link href={item.url} target={item.isExternal ? "_blank" : undefined} className="hover:underline">
              {item.url}
            </Link>
          </p>
        </div>

        {canEdit && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <button
              className="btn btn-ghost !p-1.5"
              disabled={pending || index === 0}
              onClick={() => run(() => onMove(BigInt(item.id), "up"))}
              title="上移"
            >
              <ArrowUp size={14} />
            </button>
            <button
              className="btn btn-ghost !p-1.5"
              disabled={pending || index === total - 1}
              onClick={() => run(() => onMove(BigInt(item.id), "down"))}
              title="下移"
            >
              <ArrowDown size={14} />
            </button>
            <button
              className="btn btn-ghost !p-1.5"
              disabled={pending}
              onClick={() => run(() => onToggle(BigInt(item.id)))}
              title={item.visible ? "隐藏" : "显示"}
            >
              {item.visible ? <Eye size={14} /> : <EyeOff size={14} />}
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
                  run(() => onDelete(BigInt(item.id)));
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
          <NavItemForm
            initial={{ id: item.id, label: item.label, url: item.url, isExternal: item.isExternal }}
            onSubmit={(data) => onUpdate(BigInt(item.id), data)}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
