"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";

export function PasswordForm({
  onSubmit,
}: {
  onSubmit: (input: { oldPassword: string; newPassword: string }) => Promise<unknown>;
}) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (newPassword !== confirm) {
      setError("两次输入的新密码不一致");
      return;
    }
    setPending(true);
    try {
      await onSubmit({ oldPassword, newPassword });
      setOldPassword("");
      setNewPassword("");
      setConfirm("");
      setOk("密码已修改，下次登录请使用新密码");
    } catch (e) {
      setError(e instanceof Error ? e.message : "修改失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <KeyRound size={15} />
        修改密码
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">当前密码</label>
          <input
            type="password"
            className="input"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="label">新密码</label>
          <input
            type="password"
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="label">确认新密码</label>
          <input
            type="password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {ok && <p className="text-sm text-accent">{ok}</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn btn-outline" disabled={pending}>
          {pending ? "修改中…" : "修改密码"}
        </button>
      </div>
    </form>
  );
}
