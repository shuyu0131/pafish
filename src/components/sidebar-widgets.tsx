import Link from "next/link";
import { prisma } from "@/lib/db";
import { POST_STATUS, COMMENT_STATUS } from "@/lib/constants";
import { buildCategoryTree } from "@/lib/category-tree";
import { getVisibleWidgets } from "@/lib/widgets";
import { WIDGET_DEFAULT_TITLE } from "@/lib/widget-constants";

// 左栏侧边栏组件区：按后台配置的顺序/启停渲染
export async function SidebarWidgets() {
  const widgets = await getVisibleWidgets();
  if (widgets.length === 0) return null;

  return (
    <div className="mt-14 w-full space-y-10 px-8">
      {widgets.map((w) => (
        <WidgetBlock key={String(w.id)} type={w.type} title={w.title} content={w.content} />
      ))}
    </div>
  );
}

async function WidgetBlock({
  type,
  title,
  content,
}: {
  type: string;
  title: string | null;
  content: string | null;
}) {
  const label = title?.trim() || WIDGET_DEFAULT_TITLE[type as keyof typeof WIDGET_DEFAULT_TITLE] || type;

  if (type === "custom") {
    return (
      <section aria-label={label}>
        <h2 className="mb-4 text-[10px] uppercase tracking-[0.2em] text-meta">{label}</h2>
        <div className="space-y-2 text-center text-xs leading-relaxed text-side">
          {(content ?? "").split(/\r?\n/).map((line, i) => {
            const m = line.match(/^\[(.+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)$/);
            return m ? (
              <p key={i}>
                <a href={m[2]} target="_blank" rel="noreferrer" className="text-side transition-colors hover:text-accent">
                  {m[1]}
                </a>
              </p>
            ) : (
              <p key={i}>{line}</p>
            );
          })}
        </div>
      </section>
    );
  }

  if (type === "categories") {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, parentId: true, sortOrder: true },
    });
    const tree = buildCategoryTree(categories);
    if (tree.length === 0) return null;
    return (
      <section aria-label={label}>
        <h2 className="mb-4 text-center text-[10px] uppercase tracking-[0.2em] text-meta">{label}</h2>
        <nav className="flex flex-col items-center gap-2.5 text-sm">
          {tree.map((c) => (
            <Link
              key={c.id}
              href={`/category/${encodeURIComponent(c.slug)}`}
              className="text-side transition-colors hover:text-accent"
              style={{ paddingLeft: c.depth * 14 }}
            >
              {c.depth > 0 ? "└ " : ""}
              {c.name}
            </Link>
          ))}
        </nav>
      </section>
    );
  }

  if (type === "tags") {
    const tags = await prisma.tag.findMany({
      include: { _count: { select: { posts: true } } },
      orderBy: { posts: { _count: "desc" } },
      take: 20,
    });
    if (tags.length === 0) return null;
    return (
      <section aria-label={label}>
        <h2 className="mb-4 text-center text-[10px] uppercase tracking-[0.2em] text-meta">{label}</h2>
        <div className="flex flex-wrap justify-center gap-2 text-xs">
          {tags.map((t) => (
            <Link
              key={String(t.id)}
              href={`/tag/${encodeURIComponent(t.slug)}`}
              className="text-side transition-colors hover:text-accent"
            >
              #{t.name}
            </Link>
          ))}
        </div>
      </section>
    );
  }

  if (type === "recent_posts" || type === "hot_posts") {
    const posts = await prisma.post.findMany({
      where: { status: POST_STATUS.PUBLISHED, publishedAt: { lte: new Date() }, deletedAt: null },
      orderBy: type === "hot_posts" ? { viewCount: "desc" } : { publishedAt: "desc" },
      take: 6,
      select: { title: true, slug: true, publishedAt: true },
    });
    if (posts.length === 0) return null;
    return (
      <section aria-label={label}>
        <h2 className="mb-4 text-center text-[10px] uppercase tracking-[0.2em] text-meta">{label}</h2>
        <div className="flex flex-col items-center gap-2.5 text-sm">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/post/${encodeURIComponent(p.slug)}`}
              className="text-center text-side transition-colors hover:text-accent"
            >
              {p.title}
            </Link>
          ))}
        </div>
      </section>
    );
  }

  if (type === "recent_comments") {
    const comments = await prisma.comment.findMany({
      where: { status: COMMENT_STATUS.APPROVED },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, authorName: true, post: { select: { title: true, slug: true } } },
    });
    if (comments.length === 0) return null;
    return (
      <section aria-label={label}>
        <h2 className="mb-4 text-center text-[10px] uppercase tracking-[0.2em] text-meta">{label}</h2>
        <div className="flex flex-col items-center gap-2.5 text-xs">
          {comments.map((c) => (
            <Link
              key={String(c.id)}
              href={`/post/${encodeURIComponent(c.post.slug)}#comments`}
              className="text-center text-side transition-colors hover:text-accent"
            >
              {c.authorName} 评论了《{c.post.title}》
            </Link>
          ))}
        </div>
      </section>
    );
  }

  return null;
}
