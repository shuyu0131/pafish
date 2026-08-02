"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createLink,
  deleteLink,
  moveLink,
  toggleLinkVisible,
  updateLink,
} from "@/app/admin/actions";

type LinkRow = {
  id: string;
  name: string;
  url: string;
  description: string;
  sortOrder: number;
  visible: boolean;
};

export function LinkManager({ links }: { links: LinkRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<LinkRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  function openCreate() {
    setEditing(null);
    setName("");
    setUrl("");
    setDescription("");
    setShowForm(true);
  }

  function openEdit(l: LinkRow) {
    setEditing(l);
    setName(l.name);
    setUrl(l.url);
    setDescription(l.description);
    setShowForm(true);
  }

  function submit() {
    if (!name.trim() || !url.trim()) {
      setError("名称和地址不能为空");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        if (editing) {
          await updateLink(editing.id, {
            name: name.trim(),
            url: url.trim(),
            description: description.trim(),
          });
        } else {
          await createLink({
            name: name.trim(),
            url: url.trim(),
            description: description.trim(),
          });
        }
        setShowForm(false);
        setEditing(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* 新增按钮 */}
      {!showForm && (
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={15} />
          添加链接
        </button>
      )}

      {/* 表单 */}
      {showForm && (
        <div className="card space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="站点名称"
              className="input"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="input"
            />
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简介（可选）"
            className="input"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={submit}
            >
              {editing ? "保存修改" : "添加"}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 链接列表 */}
      <div className="card divide-y divide-border overflow-hidden">
        {links.length === 0 && !showForm && (
          <div className="flex flex-col items-center gap-3 py-14 text-muted">
            <Link2 size={30} strokeWidth={1.5} />
            <p className="text-sm">还没有友情链接</p>
          </div>
        )}
        {links.map((l, i) => (
          <div key={l.id} className="flex items-center gap-3 px-5 py-3.5">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => run(() => moveLink(BigInt(l.id), "up"))}
                className="text-muted hover:text-accent disabled:opacity-30"
                title="上移"
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                disabled={i === links.length - 1}
                onClick={() => run(() => moveLink(BigInt(l.id), "down"))}
                className="text-muted hover:text-accent disabled:opacity-30"
                title="下移"
              >
                <ArrowDown size={13} />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {l.name}
                {!l.visible && (
                  <span className="badge ml-2 !text-[10px]">已隐藏</span>
                )}
              </p>
              <p className="truncate text-xs text-muted">
                {l.url}
                {l.description && ` · ${l.description}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
                onClick={() => run(() => toggleLinkVisible(BigInt(l.id)))}
                title={l.visible ? "隐藏" : "显示"}
              >
                {l.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button
                type="button"
                className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
                onClick={() => openEdit(l)}
                title="编辑"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
                onClick={() => {
                  if (window.confirm(`确定删除链接「${l.name}」？`)) {
                    run(() => deleteLink(BigInt(l.id)));
                  }
                }}
                title="删除"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
