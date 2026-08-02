"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Flag } from "lucide-react";
import { setCommentStatus } from "../actions";

export function CommentActionButton({
  id,
  status,
  label,
  variant = "primary",
}: {
  id: string;
  status: string;
  label: string;
  variant?: "primary" | "outline";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      try {
        await setCommentStatus(id, status);
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
      className={
        variant === "primary"
          ? "btn btn-primary !px-2.5 !py-1.5 !text-xs"
          : "btn btn-outline !px-2.5 !py-1.5 !text-xs"
      }
    >
      {label === "垃圾" ? <Flag size={13} /> : <Check size={13} />}
      {label}
    </button>
  );
}
