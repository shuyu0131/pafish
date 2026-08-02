"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import type { CategoryTreeItem } from "@/lib/category-tree";
import { CategorySelect } from "@/components/admin/category-select";

interface CategoryFormProps {
  onSubmit: (data: {
    name: string;
    slug: string;
    description: string;
    parentId: string | null;
  }) => Promise<unknown>;
  initial?: { name: string; slug: string; description: string; parentId: string | null };
  categories?: CategoryTreeItem[];
  /** 编辑时不可选为父分类的 id（自身及其后代） */
  disabledParentIds?: string[];
  triggerLabel?: string;
  submitLabel?: string;
}

export function CategoryForm({
  onSubmit,
  initial,
  categories = [],
  disabledParentIds = [],
  triggerLabel = "保存",
  submitLabel = "创建",
}: CategoryFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [parentId, setParentId] = useState(initial?.parentId ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // 编辑按钮（列表内触发）
  if (initial && !editing) {
    return (
      <button
        type="button"
        className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
        onClick={() => setEditing(true)}
      >
        <Pencil size={14} />
        编辑
      </button>
    );
  }

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
      await onSubmit({
        name: name.trim(),
        slug: slug.trim() || name.trim(),
        description: description.trim(),
        parentId: parentId || null,
      });
      router.refresh();
      if (!initial) {
        setName("");
        setSlug("");
        setSlugTouched(false);
        setDescription("");
        setParentId("");
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
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">名称</label>
          <input
            className="input"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="如：技术"
            required
          />
        </div>
        <div>
          <label className="label">Slug</label>
          <input
            className="input"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            placeholder="自动生成"
          />
        </div>
      </div>
      <div>
        <label className="label">父分类</label>
        <CategorySelect
          value={parentId}
          onChange={setParentId}
          categories={categories}
          topOptions={[{ value: "", label: "无（顶级分类）" }]}
          disabledValues={disabledParentIds}
          placeholder="无（顶级分类）"
        />
      </div>
      <div>
        <label className="label">描述</label>
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="分类描述（可选）"
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary !text-xs" disabled={pending}>
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
