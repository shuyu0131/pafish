"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// 找回密码：输入邮箱 → 发送验证码 → 输入验证码 + 新密码直接重置
export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"input" | "reset" | "done">("input");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // 发送验证码倒计时（秒），0 表示可发送
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCountdown() {
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  // 第一步：发送验证码（未注册邮箱也统一提示"已发送"，防枚举）
  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("请输入正确的邮箱");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "reset" }),
      });
      const data = await res.json();
      if (!res.ok) {
        // SMTP 未配置时提示联系管理员，不进入下一步
        setError(data.error || "发送失败");
        return;
      }
      setState("reset");
      startCountdown();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  // 第二步：验证码 + 新密码重置
  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-by-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "重置失败");
        return;
      }
      setState("done");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  if (state === "done") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted">密码已重置，请使用新密码登录。</p>
        <Link href="/login" className="btn btn-primary w-full">
          去登录
        </Link>
      </div>
    );
  }

  if (state === "reset") {
    return (
      <form onSubmit={reset} className="space-y-4">
        <p className="text-sm text-muted">
          验证码已发送至 <span className="font-medium text-title">{email}</span>，10 分钟内有效。
        </p>
        <div>
          <label className="label" htmlFor="forgot-code">
            邮箱验证码
          </label>
          <input
            id="forgot-code"
            className="input !w-44"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6 位数字"
            maxLength={6}
            inputMode="numeric"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="forgot-password">
            新密码
          </label>
          <input
            id="forgot-password"
            type="password"
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="至少 6 位"
            autoComplete="new-password"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="forgot-confirm">
            确认新密码
          </label>
          <input
            id="forgot-confirm"
            type="password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="再次输入新密码"
            autoComplete="new-password"
            required
          />
        </div>

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? "提交中…" : "重置密码"}
        </button>
        <p className="text-center text-xs text-muted">
          未收到验证码？
          <button
            type="button"
            className="ml-1 text-accent hover:underline disabled:text-muted"
            onClick={sendCode}
            disabled={loading || countdown > 0}
          >
            {countdown > 0 ? `${countdown}s 后重发` : "重新发送"}
          </button>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="space-y-4">
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
        <p className="mt-1 text-xs text-muted">
          输入邮箱后点击发送，验证码将通过邮件送达（未注册邮箱同样提示已发送）。
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? "发送中…" : "发送验证码"}
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
