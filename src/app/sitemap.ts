import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories, tags, pages] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED", publishedAt: { lte: new Date() }, deletedAt: null },
      orderBy: { publishedAt: "desc" },
      select: { slug: true, publishedAt: true },
    }),
    prisma.category.findMany({ select: { slug: true } }),
    prisma.tag.findMany({ select: { slug: true } }),
    prisma.page.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  return [
    {
      url: siteUrl("/"),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: siteUrl("/archives"),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: siteUrl("/about"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...posts.map((p) => ({
      url: siteUrl(`/post/${encodeURIComponent(p.slug)}`),
      lastModified: p.publishedAt ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...categories.map((c) => ({
      url: siteUrl(`/category/${encodeURIComponent(c.slug)}`),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...tags.map((t) => ({
      url: siteUrl(`/tag/${encodeURIComponent(t.slug)}`),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
    ...pages.map((p) => ({
      url: siteUrl(`/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
