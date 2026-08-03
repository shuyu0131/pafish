"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ShieldBan, ShieldCheck, KeyRound } from "lucide-react";
import { toggleUserDisabled, resetUserPassword } from "../actions";

// 仅 ADMIN 可见：禁用/解禁 + 重置密码
export function UserActions({
  userId,
  disabled,
  isSelf,
}: {
  userId: string;
  disabled: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");

  function run(fn: () => Promise<void>) {
    setError("");
    startTransition(async () => {
      try {
        await fn();
        setConfirmDisable(false);
        setShowReset(false);
        setNewPassword("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  if (showReset) {
    return (
      <div className="flex items-center gap-2">
        <input
          className="input w-40 py-1.5 text-xs"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="新密码（≥6 位）"
          autoComplete="off"
        />
        <button
          className="btn btn-primary btn-sm"
          disabled={pending || newPassword.length < 6}
          onClick={() => run(() => resetUserPassword(BigInt(userId), newPassword))}
        >
          保存
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={pending}
          onClick={() => {
            setShowReset(false);
            setNewPassword("");
            setError("");
          }}
        >
          取消
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <p className="text-xs text-danger">{error}</p>}
      {isSelf ? (
        <span className="text-xs text-muted">当前账号</span>
      ) : (
        <>
          {disabled ? (
            <button
              className="btn btn-outline btn-sm"
              disabled={pending}
              onClick={() => run(() => toggleUserDisabled(BigInt(userId), false))}
            >
              <ShieldCheck size={14} />
              解禁
            </button>
          ) : (
            <button
              className={confirmDisable ? "btn btn-danger btn-sm" : "btn btn-ghost btn-sm"}
              disabled={pending}
              onClick={() => {
                if (!confirmDisable) {
                  setConfirmDisable(true);
                } else {
                  run(() => toggleUserDisabled(BigInt(userId), true));
                }
              }}
            >
              <ShieldBan size={14} />
              {confirmDisable ? "确认禁用？" : "禁用"}
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            disabled={pending}
            onClick={() => setShowReset(true)}
            title="重置该用户密码"
          >
            <KeyRound size={14} />
            重置密码
          </button>
        </>
      )}
    </div>
  );
}
