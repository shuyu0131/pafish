"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setHomePage } from "@/app/admin/actions";

export function SetHomeButton({
  pageId,
  isHome,
}: {
  pageId: string;
  isHome: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await setHomePage(isHome ? null : pageId);
            router.refresh();
          } catch (e) {
            alert(e instanceof Error ? e.message : "操作失败");
          }
        })
      }
      className="btn btn-outline !px-2.5 !py-1.5 !text-xs"
      title={isHome ? "取消设为首页" : "设为首页"}
    >
      {isHome ? "取消首页" : "设为首页"}
    </button>
  );
}
