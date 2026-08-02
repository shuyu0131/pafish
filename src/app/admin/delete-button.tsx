"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

export function DeleteButton({
  id,
  action,
  confirmText,
  children,
  className = "",
}: {
  id: string;
  action: (id: bigint) => Promise<unknown>;
  confirmText: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      try {
        await action(BigInt(id));
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "操作失败");
      }
      setConfirming(false);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`btn ${confirming ? "btn-danger" : "btn-ghost"} !px-2.5 !py-1.5 !text-xs ${className}`}
      title={confirming ? "再次点击确认删除" : "删除"}
    >
      {confirming ? (
        <span>确认？</span>
      ) : (
        (children ?? <Trash2 size={14} />)
      )}
    </button>
  );
}
