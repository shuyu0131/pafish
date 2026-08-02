"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { deleteCommentsByIp, setCommentPinned } from "../actions";

// 评论置顶 / 取消置顶
export function PinButton({ id, pinned }: { id: string; pinned: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      try {
        await setCommentPinned(BigInt(id), !pinned);
        router.refresh();
      } catch {
        alert("操作失败");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      title={pinned ? "取消置顶" : "置顶（前台优先展示）"}
      className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
    >
      {pinned ? <PinOff size={13} /> : <Pin size={13} />}
      {pinned ? "取消置顶" : "置顶"}
    </button>
  );
}

// 按 IP 删除该 IP 的全部评论（两段式确认）
export function DeleteByIpButton({ ip }: { ip: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function handle() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      try {
        const n = await deleteCommentsByIp(ip);
        setResult(`已删除 ${ip} 的 ${n} 条评论`);
        router.refresh();
      } catch (e) {
        setResult(e instanceof Error ? e.message : "操作失败");
      }
      setConfirming(false);
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {result && <span className="text-xs text-accent">{result}</span>}
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        title="删除该 IP 的全部评论"
        className={`btn ${confirming ? "btn-danger" : "btn-ghost"} !px-2.5 !py-1.5 !text-xs`}
      >
        <Trash2 size={13} />
        {confirming ? "确认删除该 IP 全部评论？" : "按 IP 删除"}
      </button>
    </span>
  );
}
