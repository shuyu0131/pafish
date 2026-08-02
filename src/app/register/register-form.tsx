"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function RegisterForm({ requireVerify = true }: { requireVerify?: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
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

  // 发送注册验证码到邮箱（60 秒限频由服务端二次保障）
  async function sendCode() {
    setError("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("请先输入正确的邮箱");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "register" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "发送失败");
        return;
      }
      startCountdown();
      setError("");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "注册失败");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="reg-username">
          用户名
        </label>
        <input
          id="reg-username"
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="2-50 位，中文、字母、数字"
          autoComplete="username"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="reg-email">
          邮箱
        </label>
        <div className="flex gap-2">
          <input
            id="reg-email"
            type="email"
            className="input min-w-0 flex-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="用于找回密码"
            autoComplete="email"
            required
          />
          {requireVerify && (
            <button
              type="button"
              className="btn btn-outline shrink-0 !text-xs"
              onClick={sendCode}
              disabled={loading || countdown > 0}
            >
              {countdown > 0 ? `${countdown}s` : "发送验证码"}
            </button>
          )}
        </div>
      </div>
      {requireVerify && (
        <div>
          <label className="label" htmlFor="reg-code">
            邮箱验证码
          </label>
          <input
            id="reg-code"
            className="input !w-44"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6 位数字"
            maxLength={6}
            inputMode="numeric"
            required
          />
          <p className="mt-1 text-xs text-muted">
            验证码已发送至邮箱，10 分钟内有效；未收到请检查垃圾箱。
          </p>
        </div>
      )}
      <div>
        <label className="label" htmlFor="reg-password">
          密码
        </label>
        <input
          id="reg-password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 6 位"
          autoComplete="new-password"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="reg-confirm">
          确认密码
        </label>
        <input
          id="reg-confirm"
          type="password"
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="再次输入密码"
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
        {loading ? "注册中…" : "注 册"}
      </button>
      <p className="text-center text-xs text-muted">
        已有账号？
        <Link href="/login" className="text-accent hover:underline">
          去登录
        </Link>
      </p>
    </form>
  );
}
