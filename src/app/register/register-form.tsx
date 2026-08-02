"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        body: JSON.stringify({ username, email, password }),
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
        <input
          id="reg-email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="用于找回密码"
          autoComplete="email"
          required
        />
      </div>
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
