import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface PostCardData {
  title: string;
  slug: string;
  excerpt: string;
  coverUrl: string | null;
  publishedAt: Date | null;
  isPinned?: boolean;
  categoryPinned?: boolean;
  password?: string | null;
  externalUrl?: string | null;
  category: { name: string; slug: string } | null;
  tags: { tag: { name: string; slug: string } }[];
  author: { username: string };
  viewCount: number;
}

export function PostCard({ post }: { post: PostCardData }) {
  const isExternal = Boolean(post.externalUrl?.trim());
  return (
    <article className="post-card py-8">
      <h2 className="flex flex-wrap items-baseline gap-x-2.5 text-[1.75rem] font-semibold leading-snug tracking-[1px] text-title">
        {post.isPinned && (
          <span className="rounded-sm border border-accent/50 px-1.5 py-0.5 align-middle text-xs font-normal tracking-normal text-accent">
            置顶
          </span>
        )}
        {post.categoryPinned && (
          <span className="rounded-sm border border-accent/30 px-1.5 py-0.5 align-middle text-xs font-normal tracking-normal text-accent/70">
            分类置顶
          </span>
        )}
        {post.password && (
          <span
            className="align-middle text-sm"
            title="该文章需要密码访问"
            aria-label="需要密码"
          >
            🔒
          </span>
        )}
        {isExternal ? (
          <a
            href={post.externalUrl!.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-accent"
          >
            {post.title}
            <span className="ml-1.5 align-middle text-xs font-normal tracking-normal text-muted">
              ↗
            </span>
          </a>
        ) : (
          <Link
            href={`/post/${post.slug}`}
            className="transition-colors hover:text-accent"
          >
            {post.title}
          </Link>
        )}
      </h2>

      {post.excerpt && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">
          {post.excerpt}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-meta">
        <span>{formatDate(post.publishedAt)}</span>
        {post.category && (
          <Link
            href={`/category/${encodeURIComponent(post.category.slug)}`}
            className="transition-colors hover:text-accent"
          >
            {post.category.name}
          </Link>
        )}
        {post.tags.map((t) => (
          <Link
            key={t.tag.slug}
            href={`/tag/${encodeURIComponent(t.tag.slug)}`}
            className="transition-colors hover:text-accent"
          >
            #{t.tag.name}
          </Link>
        ))}
        <span className="ml-auto">{post.viewCount} 次浏览</span>
      </div>
    </article>
  );
}
