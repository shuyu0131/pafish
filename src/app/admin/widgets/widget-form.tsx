"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WIDGET_TYPES, WIDGET_TYPE_LABEL, WIDGET_DEFAULT_TITLE, WidgetType } from "@/lib/widget-constants";

export function WidgetForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: { id: string; type: string; title: string; content: string };
  onSubmit: (data: { type: WidgetType; title: string; content: string }) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<WidgetType>(
    (initial?.type as WidgetType) ?? "categories"
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await onSubmit({ type, title, content });
      setType("categories");
      setTitle("");
      setContent("");
      onCancel?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <h2 className="text-sm font-medium">{initial ? "编辑组件" : "添加组件"}</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">类型</label>
          <select
            className="input !w-auto"
            value={type}
            onChange={(e) => {
              const t = e.target.value as WidgetType;
              setType(t);
              if (!initial && !title) setTitle(WIDGET_DEFAULT_TITLE[t]);
            }}
          >
            {WIDGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {WIDGET_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-40 flex-1">
          <label className="label">标题（留空用默认）</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={WIDGET_DEFAULT_TITLE[type as (typeof WIDGET_TYPES)[number]]}
          />
        </div>
        <div className="flex gap-2 pb-2">
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
            {pending ? "保存中…" : "保存"}
          </button>
          {onCancel && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
              取消
            </button>
          )}
        </div>
      </div>
      {type === "custom" && (
        <div>
          <label className="label">内容（每行一段，支持 [文字](https://链接) 格式）</label>
          <textarea
            className="input min-h-28 resize-y"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"欢迎关注我的博客\n[GitHub](https://github.com)\n[邮件联系](mailto:hi@example.com)"}
            required={type === "custom"}
          />
        </div>
      )}
      <p className="text-xs text-muted">
        组件按顺序显示在左侧栏；分类/标签/最新文章/热门文章/最新评论为自动内容，自定义文本由你填写。
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
