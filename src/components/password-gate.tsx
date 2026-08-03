"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

// 文章密码门：输入正确密码后服务端写入解锁 cookie（24h），router.refresh 重新渲染正文
export function PasswordGate({
  postId,
  title,
  coverUrl,
}: {
  postId: string;
  title: string;
  coverUrl?: string | null;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function unlock() {
    setError("");
    if (!password) {
      setError("请输入访问密码");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/post/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.refresh();
      } else {
        setError(data.error || "密码错误，请重试");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto my-10 max-w-md">
      {coverUrl && (
        <img
          src={coverUrl}
          alt={title}
          className="mb-6 w-full rounded-xl object-cover"
        />
      )}
      <div className="card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
          <Lock size={20} className="text-accent" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-title">{title}</h1>
        <p className="mt-1.5 text-sm text-muted">这篇文章已加密，请输入访问密码后阅读</p>
        <input
          type="password"
          className="input mt-6 text-center"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && unlock()}
          placeholder="访问密码"
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <button
          type="button"
          className="btn btn-primary mt-4 !w-full"
          onClick={unlock}
          disabled={pending}
        >
          {pending ? "验证中…" : "解锁阅读"}
        </button>
      </div>
    </div>
  );
}
