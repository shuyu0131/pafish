import Link from "next/link";
import { prisma } from "@/lib/db";

// 首页底部友情链接区块（仅显示可见链接）
export async function FriendLinks() {
  const links = await prisma.link.findMany({
    where: { visible: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { name: true, url: true, description: true },
  });
  if (links.length === 0) return null;

  return (
    <section className="mt-12 border-t border-border pt-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        友情链接
      </h2>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {links.map((l) => (
          <li key={l.url}>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              title={l.description ?? l.name}
              className="text-sm text-side transition-colors hover:text-accent"
            >
              {l.name}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
