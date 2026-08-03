"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NavItemForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: { id: string; label: string; url: string; isExternal: boolean };
  onSubmit: (data: { label: string; url: string; isExternal: boolean }) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [isExternal, setIsExternal] = useState(initial?.isExternal ?? false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await onSubmit({ label, url, isExternal });
      setLabel("");
      setUrl("");
      setIsExternal(false);
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
      <h2 className="text-sm font-medium">{initial ? "编辑菜单项" : "新增菜单项"}</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-32 flex-1">
          <label className="label">名称</label>
          <input
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="如：首页 / 关于"
            required
          />
        </div>
        <div className="min-w-48 flex-1">
          <label className="label">地址</label>
          <input
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/archives 或 https://…"
            required
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--accent)]"
            checked={isExternal}
            onChange={(e) => setIsExternal(e.target.checked)}
          />
          外部链接（新窗口打开）
        </label>
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
      <p className="text-xs text-muted">
        地址填 / 开头为站内页面，填 http(s):// 为外部链接。菜单按顺序显示在顶部导航与移动端菜单。
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
