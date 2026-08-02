import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAdmin, canManagePosts } from "@/lib/constants";
import { LogoutButton } from "./logout-button";
import { getSettings } from "@/lib/settings";
import { avatarSrc } from "@/lib/avatar";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSidebarNav } from "@/components/admin/admin-sidebar-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: BigInt(session.id) },
    select: { username: true, nickname: true, avatarUrl: true, email: true, role: true },
  });
  if (!user) redirect("/login");

  const displayName = user.nickname || user.username;
  const avatar = avatarSrc(user.avatarUrl, user.email, 72);

  const settings = await getSettings();
  const siteName = settings.site_name || "纸鱼博客";

  const canEdit = canManagePosts(user.role);
  const unreadCount = canEdit
    ? await prisma.notification.count({ where: { read: false } })
    : 0;

  return (
    <div className="flex min-h-screen">
      <AdminShell
        username={user.username}
        displayName={displayName}
        avatar={avatar}
        role={user.role}
        siteName={siteName}
        unreadCount={unreadCount}
      />

      {/* 侧边栏（桌面端） */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link href="/admin" className="flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-tight">{siteName}</span>
            <span className="text-xs text-muted">后台</span>
          </Link>
        </div>

        <AdminSidebarNav
          canEdit={canEdit}
          canAdmin={canAdmin(user.role)}
          unreadCount={unreadCount}
        />

        <div className="border-t border-border p-3">
          <div className="mb-2 flex items-center justify-between px-3">
            <Link
              href="/admin/profile"
              className="group flex min-w-0 items-center gap-2.5"
              title="个人资料"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 rounded-full border border-border object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium group-hover:text-accent">{displayName}</p>
                <p className="truncate text-xs text-muted">
                  {user.role === "ADMIN" ? "管理员" : user.role === "EDITOR" ? "编辑" : "用户"} · {user.username}
                </p>
              </div>
            </Link>
            <LogoutButton />
          </div>
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted hover:bg-accent-soft hover:text-foreground"
          >
            <ExternalLink size={14} />
            查看博客前台
          </Link>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="min-w-0 flex-1 bg-background pt-14 md:ml-56 md:pt-0">
        <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-10">{children}</div>
      </main>
    </div>
  );
}
