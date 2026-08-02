"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Menu, X } from "lucide-react";
import { LogoutButton } from "@/app/admin/logout-button";
import { canAdmin, canManagePosts } from "@/lib/constants";
import { AdminSidebarNav } from "./admin-sidebar-nav";

export function AdminShell({
  username,
  displayName,
  avatar,
  role,
  siteName,
  unreadCount = 0,
}: {
  username: string;
  displayName: string;
  avatar: string;
  role: string;
  siteName: string;
  unreadCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const canEdit = canManagePosts(role);
  const isAdmin = canAdmin(role);

  const roleLabel = isAdmin ? "管理员" : canEdit ? "编辑" : "用户";

  return (
    <>
      {/* 移动端顶栏 */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <Link href="/admin" className="text-sm font-semibold tracking-tight">
          {siteName}
          <span className="ml-1.5 text-xs text-muted">后台</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn btn-ghost !p-2"
          aria-label="打开菜单"
          title="打开菜单"
        >
          <Menu size={18} />
        </button>
      </header>

      {/* 移动端抽屉 */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-card">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="text-sm font-semibold tracking-tight">
                {siteName}
                <span className="ml-1.5 text-xs text-muted">后台</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-ghost !p-2"
                aria-label="关闭菜单"
                title="关闭菜单"
              >
                <X size={18} />
              </button>
            </div>

            <AdminSidebarNav
              canEdit={canEdit}
              canAdmin={isAdmin}
              unreadCount={unreadCount}
              onNavigate={() => setOpen(false)}
            />

            <div className="border-t border-border p-3">
              <div className="mb-2 flex items-center justify-between px-3">
                <Link
                  href="/admin/profile"
                  onClick={() => setOpen(false)}
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
                    <p className="truncate text-xs text-muted">{roleLabel} · {username}</p>
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
        </div>
      )}
    </>
  );
}
