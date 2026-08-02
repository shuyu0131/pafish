"use client";

import Link from "next/link";
import { useState } from "react";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "link">("idle");
  const [resetUrl, setResetUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "请求失败");
        return;
      }
      if (data.sent) {
        setState("sent");
      } else if (data.resetUrl) {
        setState("link");
        setResetUrl(data.resetUrl);
      } else {
        // 邮箱未注册或账号被禁用：统一显示已发送，避免暴露邮箱是否注册
        setState("sent");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  if (state === "sent") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted">
          如果该邮箱已注册，重置链接已发送到你的邮箱，请在 30 分钟内完成重置。
        </p>
        <Link href="/login" className="btn btn-outline w-full">
          返回登录
        </Link>
      </div>
    );
  }

  if (state === "link") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          站点未配置邮件服务，请直接点击下面的重置链接（30 分钟内有效）：
        </p>
        <a
          href={resetUrl}
          className="block break-all rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent hover:underline"
        >
          {resetUrl}
        </a>
        <Link href="/login" className="btn btn-outline w-full">
          返回登录
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="forgot-email">
          注册邮箱
        </label>
        <input
          id="forgot-email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="请输入注册时使用的邮箱"
          autoComplete="email"
          required
        />
      </div>

      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? "提交中…" : "发送重置链接"}
      </button>
      <p className="text-center text-xs text-muted">
        想起密码了？
        <Link href="/login" className="text-accent hover:underline">
          去登录
        </Link>
      </p>
    </form>
  );
}
