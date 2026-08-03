import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/utils";
import { pageTemplateProps } from "@/lib/page-templates";
import PageTemplateView from "@/components/page-template-view";

// 独立页面详情（如设为首页则首页由 home 页面直接渲染，不经此路由）

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await prisma.page.findFirst({
    where: { slug: decodeURIComponent(slug), status: "PUBLISHED" },
    select: { title: true, content: true },
  });
  if (!page) return { title: "页面不存在" };
  return {
    title: page.title,
    description: page.content.replace(/[#*`>\[\]()!-]/g, "").slice(0, 120),
  };
}

export default async function PageDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await prisma.page.findFirst({
    where: { slug: decodeURIComponent(slug), status: "PUBLISHED" },
  });
  if (!page) notFound();

  const settings = await getSettings();
  const tpl = pageTemplateProps(page.template);

  return (
    <div
      {...tpl}
      className={`mx-auto w-full max-w-3xl px-6 pb-16 pt-8 lg:px-10 lg:pt-12${tpl.className ? ` ${tpl.className}` : ""}`}
    >
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
        <p className="mt-3 text-xs text-muted">
          {settings.site_name ?? "博客"} · 更新于{" "}
          {formatDateTime(page.updatedAt)}
        </p>
      </header>
      <PageTemplateView
        page={{
          slug: page.slug,
          title: page.title,
          content: page.content,
          template: page.template,
        }}
      />
    </div>
  );
}
