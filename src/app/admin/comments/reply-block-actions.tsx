"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, MessageSquareReply, Send } from "lucide-react";
import { blockIp, replyComment } from "../actions";

// 后台直接回复评论：展开输入框 → 以管理员身份发表已通过的子评论
export function ReplyButton({ id, commenter }: { id: string; commenter: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!content.trim()) {
      setError("回复内容不能为空");
      return;
    }
    startTransition(async () => {
      try {
        await replyComment(BigInt(id), content);
        setOpen(false);
        setContent("");
        setError("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "回复失败");
      }
    });
  }

  return (
    <div>
      {open ? (
        <div className="mt-2 w-full rounded-lg border border-border bg-muted/30 p-2.5">
          <p className="mb-1.5 text-xs text-muted">
            回复 @{commenter}（以管理员身份发表，前台直接显示）
          </p>
          <textarea
            className="input min-h-20 resize-y !text-xs"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setError("");
            }}
            placeholder="输入回复内容…"
            autoFocus
          />
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              className="btn btn-primary !px-2.5 !py-1.5 !text-xs"
              onClick={submit}
              disabled={pending}
            >
              <Send size={12} />
              {pending ? "发送中…" : "发表回复"}
            </button>
            <button
              type="button"
              className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
              onClick={() => {
                setOpen(false);
                setError("");
              }}
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
          onClick={() => setOpen(true)}
        >
          <MessageSquareReply size={13} />
          回复
        </button>
      )}
    </div>
  );
}

// 拉黑 IP：写入黑名单后该 IP 无法再提交评论（两段式确认）
export function BlockIpButton({ ip }: { ip: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handle() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      try {
        await blockIp(ip);
        setConfirming(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
        setConfirming(false);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {error && <span className="text-xs text-danger">{error}</span>}
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        title="拉黑该 IP，之后无法再提交评论"
        className={`btn ${confirming ? "btn-danger" : "btn-ghost"} !px-2.5 !py-1.5 !text-xs`}
      >
        <Ban size={13} />
        {confirming ? "确认拉黑？" : "拉黑"}
      </button>
    </span>
  );
}
