import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PostCard } from "@/components/post-card";
import { Pagination } from "@/components/pagination";
import { FriendLinks } from "@/components/friend-links";
import { pageTemplateProps } from "@/lib/page-templates";
import PageTemplateView from "@/components/page-template-view";

export const metadata = {
  title: "首页",
  description: "记录技术、设计与生活",
};

const POSTS_PER_PAGE = 10;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // 设置了首页页面（后台页面管理"设为首页"）则直接渲染该页面内容
  const settings = await getSettings();
  const homePageId = settings.home_page_id ?? "";
  if (/^\d+$/.test(homePageId)) {
    const homePage = await prisma.page.findFirst({
      where: { id: BigInt(homePageId), status: "PUBLISHED" },
    });
    if (homePage) {
      const tpl = pageTemplateProps(homePage.template);
      return (
        <div
          {...tpl}
          className={`mx-auto w-full max-w-3xl px-6 pb-16 pt-8 lg:px-10 lg:pt-12${tpl.className ? ` ${tpl.className}` : ""}`}
        >
          <header className="mb-8 border-b border-border pb-6">
            <h1 className="text-3xl font-semibold tracking-tight">
              {homePage.title}
            </h1>
          </header>
          <PageTemplateView
            page={{
              slug: homePage.slug,
              title: homePage.title,
              content: homePage.content,
              template: homePage.template,
            }}
          />
        </div>
      );
    }
  }

  const { page: pageParam } = await searchParams;
  const pageNum = Math.max(1, Number(pageParam) || 1);
  const perPage = Math.min(
    50,
    Math.max(1, Number(settings.posts_per_page || POSTS_PER_PAGE))
  );

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED", publishedAt: { lte: new Date() }, deletedAt: null },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      skip: (pageNum - 1) * perPage,
      take: perPage,
      select: {
        title: true,
        slug: true,
        excerpt: true,
        coverUrl: true,
        publishedAt: true,
        isPinned: true,
        categoryPinned: true,
        password: true,
        externalUrl: true,
        viewCount: true,
        category: { select: { name: true, slug: true } },
        tags: { select: { tag: { select: { name: true, slug: true } } } },
        author: { select: { username: true } },
      },
    }),
    prisma.post.count({
      where: { status: "PUBLISHED", publishedAt: { lte: new Date() }, deletedAt: null },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="mx-auto w-full px-6 pb-16 pt-8 lg:px-10 lg:pt-12">
      {/* 文章列表 */}
      {posts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-lg text-muted">还没有文章，敬请期待</p>
        </div>
      ) : (
        <div>
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-10">
          <Pagination page={pageNum} totalPages={totalPages} buildHref={(n) => `/?page=${n}`} />
        </div>
      )}

      <FriendLinks />
    </div>
  );
}
