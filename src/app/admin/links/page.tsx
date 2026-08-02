import Link from "next/link";
import { Link2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import { LinkManager } from "./link-manager";

export const metadata = { title: "友情链接" };

export default async function AdminLinksPage() {
  const session = await requireSession();
  const canEdit = canManagePosts(session.role);
  const links = await prisma.link.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">友情链接</h1>
        <p className="mt-1 text-sm text-muted">
          展示在首页底部，共 {links.length} 个（含隐藏）
        </p>
      </div>
      {canEdit ? (
        <LinkManager
          links={links.map((l) => ({
            id: String(l.id),
            name: l.name,
            url: l.url,
            description: l.description ?? "",
            sortOrder: l.sortOrder,
            visible: l.visible,
          }))}
        />
      ) : (
        <div className="card divide-y divide-border overflow-hidden">
          {links.map((l) => (
            <div key={String(l.id)} className="flex items-center gap-3 px-5 py-3">
              <Link2 size={15} className="text-muted" />
              <span className="text-sm">{l.name}</span>
              <span className="truncate text-xs text-muted">{l.url}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
