import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Calendar, User, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getThemeValues } from "@/lib/theme";
import { siteUrl } from "@/lib/site";
import { formatDate } from "@/lib/utils";
import { MarkdownRender } from "@/components/markdown-render";
import { CommentSection } from "@/components/comment-section";
import { ViewTracker } from "@/components/view-tracker";
import { RelatedPosts } from "@/components/related-posts";
import { PasswordGate } from "@/components/password-gate";
import { PostActions } from "@/components/post-actions";

export const dynamic = "force-dynamic";

// 动态 SEO：文章标题/摘要/封面进入 OG 标签，微信微博分享有卡片
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const post = await prisma.post.findUnique({
    where: { slug, deletedAt: null },
    select: {
      title: true,
      excerpt: true,
      coverUrl: true,
      publishedAt: true,
      updatedAt: true,
      author: { select: { username: true } },
      category: { select: { name: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });
  if (!post) return { title: "文章未找到" };
  const url = siteUrl(`/post/${rawSlug}`);
  return {
    title: post.title,
    description: post.excerpt || undefined,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.excerpt || undefined,
      images: post.coverUrl ? [{ url: post.coverUrl }] : undefined,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt?.toISOString(),
      authors: [siteUrl("/about")],
      section: post.category?.name,
      tags: post.tags.map((t) => t.tag.name),
    },
  };
}

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug: rawSlug } = await params;
  const sp = await searchParams;
  // 评论分页参数（cpage），非法值回退到第 1 页
  const commentPage = Math.max(1, Number(sp.cpage) || 1);
  // Next.js App Router 对路径参数不做 URL 解码，中文 slug 需手动解码
  const slug = decodeURIComponent(rawSlug);

  const [post, settings, theme] = await Promise.all([
    prisma.post.findUnique({
      where: { slug, deletedAt: null },
      include: {
        author: { select: { username: true } },
        category: { select: { name: true, slug: true } },
        tags: { select: { tagId: true, tag: { select: { name: true, slug: true } } } },
      },
    }),
    getSettings(),
    getThemeValues(),
  ]);

  if (!post || post.status !== "PUBLISHED" || !post.publishedAt || post.publishedAt > new Date()) {
    notFound();
  }

  // 相邻文章
  const [prevPost, nextPost] = await Promise.all([
    prisma.post.findFirst({
      where: {
        status: "PUBLISHED",
        publishedAt: { lt: post.publishedAt },
        deletedAt: null,
      },
      orderBy: { publishedAt: "desc" },
      select: { title: true, slug: true },
    }),
    prisma.post.findFirst({
      where: {
        status: "PUBLISHED",
        publishedAt: { gt: post.publishedAt },
        deletedAt: null,
      },
      orderBy: { publishedAt: "asc" },
      select: { title: true, slug: true },
    }),
  ]);

  // 浏览量由客户端 ViewTracker 上报（7 天去重），此处不再服务端 +1

  const commentsEnabled = settings.comments_enabled !== "false";
  const needReview = settings.comments_need_review !== "false";

  const cookieStore = await cookies();
  // 密码保护：有密码且未解锁（解锁 cookie 24h）→ 渲染密码门
  const locked = Boolean(post.password) &&
    cookieStore.get(`unlocked_post_${post.id}`)?.value !== "1";

  // 点赞/收藏初始状态（cookie 记录）
  const postLikes = (cookieStore.get("liked_posts")?.value ?? "").split(",").filter(Boolean);
  const postFavorites = (cookieStore.get("favorited_posts")?.value ?? "").split(",").filter(Boolean);
  const postKey = String(post.id);

  // 自定义字段解析（坏数据容错为空）
  let customFields: { key: string; value: string }[] = [];
  if (post.customFields) {
    try {
      const parsed = JSON.parse(post.customFields);
      if (Array.isArray(parsed)) customFields = parsed;
    } catch {
      customFields = [];
    }
  }

  return (
    <div className="mx-auto w-full px-6 pb-16 pt-8 lg:px-[30px] lg:pt-12">
      {/* 面包屑 */}
      <nav className="mb-6 text-xs text-meta">
        <Link href="/" className="transition-colors hover:text-accent">
          首页
        </Link>
        {post.category && (
          <>
            <span className="mx-1.5">/</span>
            <Link href={`/category/${post.category.slug}`} className="transition-colors hover:text-accent">
              {post.category.name}
            </Link>
          </>
        )}
        <span className="mx-1.5">/</span>
        <span className="text-foreground">{post.title}</span>
      </nav>

      {locked ? (
        <PasswordGate
          postId={String(post.id)}
          title={post.title}
          coverUrl={post.coverUrl}
        />
      ) : (
        <>
      {/* 标题区 */}
      <header className="mb-8">
        <h1 className="editorial text-3xl leading-snug text-title sm:text-4xl">
          {post.title}
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-meta">
          <span className="flex items-center gap-1.5">
            <User size={13} />
            {post.author.username}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar size={13} />
            {formatDate(post.publishedAt)}
          </span>
          <ViewTracker postId={String(post.id)} viewCount={post.viewCount} />
          <PostActions
            postId={String(post.id)}
            likeCount={post.likeCount}
            favoriteCount={post.favoriteCount}
            liked={postLikes.includes(postKey)}
            favorited={postFavorites.includes(postKey)}
          />
          {post.tags.length > 0 && (
            <span className="flex flex-wrap items-center gap-x-3">
              {post.tags.map((t) => (
                <Link
                  key={t.tag.slug}
                  href={`/tag/${t.tag.slug}`}
                  className="text-side transition-colors hover:text-accent"
                >
                  #{t.tag.name}
                </Link>
              ))}
            </span>
          )}
        </div>
        {post.externalUrl && (
          <a
            href={post.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
          >
            查看原文
            <ExternalLink size={13} />
          </a>
        )}
      </header>

      {post.coverUrl && (
        <img
          src={post.coverUrl}
          alt={post.title}
          className="mb-10 w-full rounded-xl object-cover"
        />
      )}

      {/* 正文 */}
      <MarkdownRender content={post.content} />

      {/* 自定义字段（外观设置可关闭） */}
      {theme.show_custom_fields !== "0" && customFields.length > 0 && (
        <dl className="mt-10 rounded-xl border border-border p-5">
          {customFields.map((f) => (
            <div
              key={f.key}
              className="flex gap-4 border-b border-border/60 py-2.5 text-sm last:border-0"
            >
              <dt className="w-28 shrink-0 font-medium text-side">{f.key}</dt>
              <dd className="min-w-0 flex-1 whitespace-pre-wrap text-muted">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* 上下篇 */}
      {(prevPost || nextPost) && (
        <div className="mt-14 flex items-center justify-between gap-4 border-t border-border pt-6 text-sm">
          {prevPost ? (
            <Link
              href={`/post/${prevPost.slug}`}
              className="flex min-w-0 items-center gap-1.5 text-side transition-colors hover:text-accent"
            >
              <ChevronLeft size={15} className="shrink-0" />
              <span className="truncate">上一篇：{prevPost.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {nextPost && (
            <Link
              href={`/post/${nextPost.slug}`}
              className="flex min-w-0 items-center gap-1.5 text-side transition-colors hover:text-accent"
            >
              <span className="truncate">下一篇：{nextPost.title}</span>
              <ChevronRight size={15} className="shrink-0" />
            </Link>
          )}
        </div>
      )}

      {/* 相关推荐（外观设置可关闭） */}
      {theme.show_related_posts !== "0" && (
        <RelatedPosts
          postId={post.id}
          categoryId={post.categoryId}
          tagIds={post.tags.map((t) => t.tagId)}
        />
      )}

      {/* 评论区 */}
      {commentsEnabled && (
        <CommentSection postId={String(post.id)} needReview={needReview} page={commentPage} />
      )}

      {/* 结构化数据：Google/必应 富结果（BlogPosting） */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.excerpt || undefined,
            image: post.coverUrl
              ? post.coverUrl.startsWith("http")
                ? post.coverUrl
                : siteUrl(post.coverUrl)
              : undefined,
            datePublished: post.publishedAt?.toISOString(),
            dateModified: post.updatedAt?.toISOString(),
            author: { "@type": "Person", name: post.author.username },
            publisher: { "@type": "Organization", name: settings.site_name || "纸鱼博客" },
            mainEntityOfPage: { "@type": "WebPage", "@id": siteUrl(`/post/${encodeURIComponent(post.slug)}`) },
            articleSection: post.category?.name,
            keywords: post.tags.map((t) => t.tag.name).join(", "),
          }),
        }}
      />
        </>
      )}
    </div>
  );
}
