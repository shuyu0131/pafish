import { Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { avatarSrc } from "@/lib/avatar";
import { updateUserRole } from "../actions";
import { RoleSelect } from "./role-select";
import { UserActions } from "./user-actions";

export const metadata = { title: "用户管理" };

export default async function UsersPage() {
  const me = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { posts: true, comments: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">用户管理</h1>
        <p className="mt-1 text-sm text-muted">共 {users.length} 个用户</p>
      </div>

      <div className="card divide-y divide-border overflow-hidden">
        {users.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted">
            <Users size={32} strokeWidth={1.5} />
            <p className="text-sm">暂无用户</p>
          </div>
        )}
        {users.map((u) => (
          <div key={String(u.id)} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarSrc(u.avatarUrl, u.email, 80)}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <p className="truncate text-sm font-medium">
                    {u.nickname || u.username}
                    {u.nickname && <span className="ml-1.5 text-xs font-normal text-muted">@{u.username}</span>}
                  </p>
                  <span className="badge badge-accent">{ROLE_LABEL[u.role]}</span>
                  {u.disabled && <span className="badge badge-danger">已禁用</span>}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {u.email} · 注册于 {formatDate(u.createdAt)} · {u._count.posts} 篇文章 ·{" "}
                  {u._count.comments} 条评论
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <RoleSelect userId={String(u.id)} role={u.role} onUpdate={updateUserRole} />
              {me.role === "ADMIN" && (
                <UserActions
                  userId={String(u.id)}
                  disabled={u.disabled}
                  isSelf={me.id === String(u.id)}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
