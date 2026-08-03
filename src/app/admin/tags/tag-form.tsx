"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

interface TagFormProps {
  onSubmit: (data: { name: string; slug: string }) => Promise<unknown>;
  initial?: { name: string; slug: string };
  triggerLabel?: string;
  submitLabel?: string;
}

export function TagForm({
  onSubmit,
  initial,
  triggerLabel = "保存",
  submitLabel = "创建",
}: TagFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // 编辑按钮（列表内触发）
  if (initial && !editing) {
    return (
      <button
        type="button"
        className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
        onClick={() => setEditing(true)}
        title="编辑标签"
      >
        <Pencil size={14} />
        编辑
      </button>
    );
  }

  // 未手动改过别名时，随名称自动生成
  function onNameChange(v: string) {
    setName(v);
    if (!slugTouched) {
      setSlug(
        v
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^\w\u4e00-\u9fa5-]/g, "")
          .replace(/-+/g, "-")
      );
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await onSubmit({ name: name.trim(), slug: slug.trim() || name.trim() });
      router.refresh();
      if (!initial) {
        setName("");
        setSlug("");
        setSlugTouched(false);
      } else {
        setEditing(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">名称</label>
          <input
            className="input"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="如：Next.js"
            required
          />
        </div>
        <div>
          <label className="label">Slug（别名）</label>
          <input
            className="input"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            placeholder="自动生成，/tag/xxx"
          />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary !w-auto !text-xs" disabled={pending}>
          {pending ? "保存中…" : submitLabel}
        </button>
        {initial && (
          <button
            type="button"
            className="btn btn-ghost !text-xs"
            onClick={() => setEditing(false)}
          >
            取消
          </button>
        )}
      </div>
    </form>
  );
}
