import Link from "next/link";
import { FileText, Home, PenLine, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import { getSetting } from "@/lib/settings";
import { formatDateTime } from "@/lib/utils";
import { deletePage } from "../actions";
import { DeleteButton } from "../delete-button";
import { SetHomeButton } from "./set-home-button";

export const metadata = { title: "页面管理" };

export default async function AdminPagesPage() {
  const session = await requireSession();
  const canEdit = canManagePosts(session.role);

  const [pages, homePageId] = await Promise.all([
    prisma.page.findMany({ orderBy: { updatedAt: "desc" } }),
    getSetting("home_page_id", ""),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">页面管理</h1>
          <p className="mt-1 text-sm text-muted">
            独立页面（关于/说明等），共 {pages.length} 个
            {homePageId && " · 已设置首页页面"}
          </p>
        </div>
        {canEdit && (
          <Link href="/admin/pages/new" className="btn btn-primary">
            <PenLine size={15} />
            新建页面
          </Link>
        )}
      </div>

      <div className="card divide-y divide-border overflow-hidden">
        {pages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted">
            <FileText size={32} strokeWidth={1.5} />
            <p className="text-sm">暂无页面</p>
            {canEdit && (
              <Link href="/admin/pages/new" className="btn btn-outline !text-xs">
                新建第一个页面
              </Link>
            )}
          </div>
        )}
        {pages.map((p) => {
          const isHome = String(p.id) === homePageId;
          return (
            <div
              key={String(p.id)}
              className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-4"
            >
              <Link
                href={`/admin/pages/${p.id}/edit`}
                className="min-w-0 flex-1"
              >
                <div className="flex items-center gap-2.5">
                  <p className="truncate text-sm font-medium hover:text-accent">
                    {p.title}
                  </p>
                  <span
                    className={
                      p.status === "PUBLISHED" ? "badge badge-success" : "badge badge-warning"
                    }
                  >
                    {p.status === "PUBLISHED" ? "已发布" : "草稿"}
                  </span>
                  {isHome && (
                    <span className="badge badge-danger">
                      <Home size={11} className="mr-1" />
                      首页
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-muted">
                  /pages/{p.slug} · 更新 {formatDateTime(p.updatedAt)}
                </p>
              </Link>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {p.status === "PUBLISHED" && (
                  <Link
                    href={`/pages/${p.slug}`}
                    target="_blank"
                    className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
                  >
                    查看
                  </Link>
                )}
                {canEdit && (
                  <SetHomeButton pageId={String(p.id)} isHome={isHome} />
                )}
                <DeleteButton
                  id={String(p.id)}
                  action={deletePage}
                  confirmText={`确定删除页面《${p.title}》？此操作不可恢复。`}
                >
                  <Trash2 size={14} />
                </DeleteButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
