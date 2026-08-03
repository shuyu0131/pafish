import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const FEED_LIMIT = 20;

export async function GET() {
  const [posts, settings] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED", publishedAt: { lte: new Date() }, deletedAt: null },
      orderBy: { publishedAt: "desc" },
      take: FEED_LIMIT,
      select: {
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        author: { select: { username: true } },
      },
    }),
    getSettings(),
  ]);

  const siteName = settings.site_name || "纸鱼博客";
  const description = settings.site_description || "";

  const items = posts
    .map((p) => {
      const url = siteUrl(`/post/${encodeURIComponent(p.slug)}`);
      return `<item>
    <title><![CDATA[${p.title}]]></title>
    <link>${url}</link>
    <guid>${url}</guid>
    <pubDate>${p.publishedAt ? p.publishedAt.toUTCString() : ""}</pubDate>
    <description><![CDATA[${p.excerpt || ""}]]></description>
  </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[${siteName}]]></title>
    <link>${siteUrl("/")}</link>
    <description><![CDATA[${description}]]></description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
