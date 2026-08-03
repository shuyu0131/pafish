"use client";

import { useState } from "react";
import { Heart, Star } from "lucide-react";

// 文章点赞/收藏：cookie 去重（服务端），客户端乐观更新 + 失败回滚
function Toggle({
  postId,
  api,
  initialCount,
  initiallyActive,
  activeLabel,
  inactiveLabel,
  icon,
  activeClass,
}: {
  postId: string;
  api: "/api/post/like" | "/api/post/favorite";
  initialCount: number;
  initiallyActive: boolean;
  activeLabel: string;
  inactiveLabel: string;
  icon: React.ReactNode;
  activeClass: string;
}) {
  const [count, setCount] = useState(initialCount);
  const [active, setActive] = useState(initiallyActive);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    const prev = { count, active };
    // 乐观更新
    setActive(!active);
    setCount(Math.max(0, count + (active ? -1 : 1)));
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActive(prev.active);
        setCount(prev.count);
      } else {
        setActive(api === "/api/post/like" ? data.liked : data.favorited);
        setCount(data.count);
      }
    } catch {
      setActive(prev.active);
      setCount(prev.count);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 transition-colors hover:opacity-75 disabled:opacity-50 ${active ? activeClass : "text-muted hover:text-accent"}`}
      title={active ? activeLabel : inactiveLabel}
    >
      {icon}
      {count > 0 && count}
    </button>
  );
}

// 详情页元信息区的点赞/收藏按钮组（放在作者/日期旁边）
export function PostActions({
  postId,
  likeCount,
  favoriteCount,
  liked,
  favorited,
}: {
  postId: string;
  likeCount: number;
  favoriteCount: number;
  liked: boolean;
  favorited: boolean;
}) {
  return (
    <span className="flex items-center gap-4">
      <Toggle
        postId={postId}
        api="/api/post/like"
        initialCount={likeCount}
        initiallyActive={liked}
        activeLabel="取消点赞"
        inactiveLabel="点赞"
        activeClass="text-accent"
        icon={<Heart size={13} className={liked ? "fill-current" : ""} />}
      />
      <Toggle
        postId={postId}
        api="/api/post/favorite"
        initialCount={favoriteCount}
        initiallyActive={favorited}
        activeLabel="取消收藏"
        inactiveLabel="收藏"
        activeClass="text-amber-500"
        icon={<Star size={13} className={favorited ? "fill-current" : ""} />}
      />
    </span>
  );
}
