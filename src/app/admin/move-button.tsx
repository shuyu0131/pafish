"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

// 通用排序按钮：调用 server action 后刷新当前页
export function MoveButton({
  action,
  disabled,
  title,
  children,
}: {
  action: () => Promise<unknown>;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn btn-ghost !px-2 !py-1.5 !text-xs"
      disabled={disabled || pending}
      title={title}
      onClick={() =>
        startTransition(async () => {
          await action();
          router.refresh();
        })
      }
    >
      {children}
    </button>
  );
}
