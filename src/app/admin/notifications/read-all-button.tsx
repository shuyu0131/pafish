"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCheck } from "lucide-react";

export function ReadAllButton({ action }: { action: () => Promise<unknown> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      try {
        await action();
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
      className="btn btn-outline !py-1.5 !text-xs"
    >
      <CheckCheck size={13} />
      {pending ? "处理中…" : "全部已读"}
    </button>
  );
}
