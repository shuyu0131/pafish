"use client";

import { Eye } from "lucide-react";
import { useEffect, useState } from "react";

// 页面挂载时上报一次浏览；7 天内同一浏览器不重复计数
export function ViewTracker({ postId, viewCount }: { postId: string; viewCount: number }) {
  const [count, setCount] = useState(viewCount);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/post-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.counted) setCount((c) => c + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [postId]);

  return (
    <span className="flex items-center gap-1.5">
      <Eye size={13} />
      {count} 次浏览
    </span>
  );
}
