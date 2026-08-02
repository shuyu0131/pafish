"use client";

import { useState } from "react";
import { CornerDownRight, Pin, ThumbsUp } from "lucide-react";
import { CommentForm } from "./comment-form";

export interface CommentNode {
  id: string;
  authorName: string;
  avatar: string;
  content: string;
  createdAtLabel: string;
  isPinned: boolean;
  likeCount: number;
  liked: boolean;
  replies: CommentNode[];
}

// 点赞按钮：乐观更新计数，失败回滚
function LikeButton({
  commentId,
  initialCount,
  initiallyLiked,
}: {
  commentId: string;
  initialCount: number;
  initiallyLiked: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initiallyLiked);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    const prev = { count, liked };
    // 乐观更新
    setLiked(!liked);
    setCount(Math.max(0, count + (liked ? -1 : 1)));
    try {
      const res = await fetch("/api/comments/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLiked(prev.liked);
        setCount(prev.count);
      } else {
        setLiked(data.liked);
        setCount(data.count);
      }
    } catch {
      setLiked(prev.liked);
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
      className={`inline-flex items-center gap-1 text-xs transition-colors hover:underline ${
        liked ? "text-accent" : "text-muted hover:text-accent"
      }`}
      title={liked ? "取消点赞" : "点赞"}
    >
      <ThumbsUp size={12} className={liked ? "fill-current" : ""} />
      {count > 0 && count}
    </button>
  );
}

function CommentItem({
  node,
  postId,
  needReview,
  depth,
  user,
  captchaEnabled,
}: {
  node: CommentNode;
  postId: string;
  needReview: boolean;
  depth: number;
  user?: { username: string; nickname: string | null } | null;
  captchaEnabled?: boolean;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <div id={`comment-${node.id}`} className="scroll-mt-24 border-l-2 border-accent/40 pl-4">
      <div className="flex items-center gap-2.5 text-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={node.avatar}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 rounded-full border border-border object-cover"
        />
        {depth > 0 && <CornerDownRight size={12} className="shrink-0 text-meta" />}
        <span className="font-medium">{node.authorName}</span>
        {node.isPinned && depth === 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
            <Pin size={9} />
            置顶
          </span>
        )}
        <span className="text-xs text-muted">{node.createdAtLabel}</span>
        <button
          type="button"
          onClick={() => setReplying((v) => !v)}
          className="text-xs text-accent transition-colors hover:underline"
        >
          {replying ? "取消回复" : "回复"}
        </button>
        <LikeButton
          commentId={node.id}
          initialCount={node.likeCount}
          initiallyLiked={node.liked}
        />
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
        {node.content}
      </p>

      {replying && (
        <CommentForm
          postId={postId}
          needReview={needReview}
          parentId={node.id}
          compact
          onDone={() => setReplying(false)}
          user={user}
          captchaEnabled={captchaEnabled}
        />
      )}

      {node.replies.length > 0 && (
        <div className="mt-4 space-y-4">
          {node.replies.map((r) => (
            <CommentItem
              key={r.id}
              node={r}
              postId={postId}
              needReview={needReview}
              depth={depth + 1}
              user={user}
              captchaEnabled={captchaEnabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentThread({
  comments,
  postId,
  needReview,
  user,
  captchaEnabled,
}: {
  comments: CommentNode[];
  postId: string;
  needReview: boolean;
  user?: { username: string; nickname: string | null } | null;
  captchaEnabled?: boolean;
}) {
  return (
    <div className="mt-8 space-y-5">
      {comments.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">
          还没有评论，来抢沙发吧
        </p>
      )}
      {comments.map((c) => (
        <CommentItem
          key={c.id}
          node={c}
          postId={postId}
          needReview={needReview}
          depth={0}
          user={user}
          captchaEnabled={captchaEnabled}
        />
      ))}
    </div>
  );
}
