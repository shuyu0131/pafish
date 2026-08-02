"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CommentForm({
  postId,
  needReview,
  parentId,
  compact,
  onDone,
}: {
  postId: string;
  needReview: boolean;
  parentId?: string | null;
  compact?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  // 勾选后有人回复这条评论时发邮件提醒（存到评论上）
  const [notifyReply, setNotifyReply] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          name,
          email,
          content,
          parentId: parentId ?? null,
          notifyReply,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "提交失败");
        return;
      }
      setContent("");
      setMessage(
        needReview
          ? "评论已提交，审核通过后将显示。"
          : "评论发表成功！"
      );
      router.refresh();
      onDone?.();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={`space-y-3 ${compact ? "mt-3" : "mt-6"}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="昵称 *"
          maxLength={50}
          required
        />
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱（不会公开显示）"
          maxLength={255}
        />
      </div>
      <textarea
        className="input min-h-28 resize-y"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="写下你的想法…"
        maxLength={2000}
        required
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      {message && <p className="text-sm text-accent">✓ {message}</p>}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[var(--accent)]"
            checked={notifyReply}
            onChange={(e) => setNotifyReply(e.target.checked)}
          />
          有人回复我时邮件通知
        </label>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted">
            {needReview ? "评论需审核后显示" : "评论将直接显示"}
          </p>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "提交中…" : "发表评论"}
          </button>
        </div>
      </div>
    </form>
  );
}
