"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export function CommentForm({
  postId,
  needReview,
  parentId,
  compact,
  onDone,
  user,
  captchaEnabled = true,
}: {
  postId: string;
  needReview: boolean;
  parentId?: string | null;
  compact?: boolean;
  onDone?: () => void;
  // 已登录用户：自动使用登录身份，隐藏昵称/邮箱输入（服务端强制，不可伪造）
  user?: { username: string; nickname: string | null } | null;
  // 未登录时是否要求图形验证码（后台开关）
  captchaEnabled?: boolean;
}) {
  const router = useRouter();
  const loggedIn = !!user;
  // 未登录游客才需要验证码
  const needCaptcha = !loggedIn && captchaEnabled;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  // 勾选后有人回复这条评论时发邮件提醒（存到评论上）
  const [notifyReply, setNotifyReply] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaSvg, setCaptchaSvg] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  // 进入表单时获取验证码（未登录且开启验证码时）
  useEffect(() => {
    if (!needCaptcha) return;
    let cancelled = false;
    fetch("/api/captcha")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) {
          setCaptchaToken(d.token);
          setCaptchaSvg(d.svg);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needCaptcha]);

  // 验证码失败/刷新时重新获取
  async function refreshCaptcha() {
    try {
      const r = await fetch("/api/captcha");
      if (r.ok) {
        const d = await r.json();
        setCaptchaToken(d.token);
        setCaptchaSvg(d.svg);
        setCaptchaAnswer("");
      }
    } catch {
      // 网络异常时保持原验证码
    }
  }

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
          captchaToken,
          captchaAnswer,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "提交失败");
        // 验证码错误（或作废）时刷新验证码，方便重新输入
        if (data.error?.includes("验证码")) refreshCaptcha();
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
      {loggedIn ? (
        <p className="text-xs text-muted">
          以 <span className="font-medium text-title">{user!.nickname || user!.username}</span> 的身份评论
          （{user!.username}）
        </p>
      ) : (
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
      )}
      <textarea
        className="input min-h-28 resize-y"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="写下你的想法…"
        maxLength={2000}
        required
      />
      {needCaptcha && (
        <div className="flex items-center gap-3">
          {/* 验证码 SVG：currentColor 自适应亮暗主题 */}
          <button
            type="button"
            onClick={refreshCaptcha}
            className="shrink-0 rounded-lg border border-border bg-muted/30 p-1.5 text-muted transition-colors hover:text-title"
            title="看不清？点击刷新"
          >
            {captchaSvg ? (
              <span dangerouslySetInnerHTML={{ __html: captchaSvg }} />
            ) : (
              <RefreshCw size={20} />
            )}
          </button>
          <input
            className="input !w-36"
            value={captchaAnswer}
            onChange={(e) => setCaptchaAnswer(e.target.value)}
            placeholder="验证码 *"
            maxLength={8}
            required
          />
          <button
            type="button"
            onClick={refreshCaptcha}
            className="inline-flex shrink-0 items-center gap-1 text-xs text-muted transition-colors hover:text-accent"
          >
            <RefreshCw size={12} />
            换一张
          </button>
        </div>
      )}
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
