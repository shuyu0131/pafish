"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ADMIN_NAV_GROUPS, ADMIN_TOP_ITEMS, type AdminNavItem } from "@/lib/admin-nav";

const COLLAPSE_KEY = "admin_nav_collapsed";

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function AdminSidebarNav({
  canEdit,
  canAdmin,
  unreadCount = 0,
  onNavigate,
}: {
  canEdit: boolean;
  canAdmin: boolean;
  unreadCount?: number;
  onNavigate?: () => void; // 移动端关闭抽屉用
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // 折叠状态本地记忆
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]));
    } catch {
      // localStorage 不可用时保持默认全部展开
    }
  }, []);

  function toggleGroup(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]));
      } catch {
        // 忽略写入失败
      }
      return next;
    });
  }

  // 权限过滤 + 通知徽标
  const topItems = ADMIN_TOP_ITEMS.map((i) =>
    i.href === "/admin/notifications" ? { ...i, badge: unreadCount } : i
  );
  const groups = ADMIN_NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items
      .filter((i) =>
        i.require === "edit" ? canEdit : i.require === "admin" ? canAdmin : true
      )
      .map((i) =>
        i.href === "/admin/notifications" ? { ...i, badge: unreadCount } : i
      ),
  })).filter((g) => g.items.length > 0);

  function renderItem(item: AdminNavItem) {
    const active = isActive(pathname, item.href, item.exact);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
          active
            ? "bg-accent-soft font-medium text-foreground"
            : "text-muted hover:bg-accent-soft hover:text-foreground"
        }`}
      >
        <item.icon size={16} />
        <span className="truncate">{item.label}</span>
        {item.badge ? (
          <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
      {topItems.map(renderItem)}

      {groups.map((g) => {
        const open = !collapsed.has(g.id);
        const groupActive = g.items.some((i) => isActive(pathname, i.href, i.exact));
        return (
          <div key={g.id} className="pt-1.5">
            <button
              type="button"
              onClick={() => toggleGroup(g.id)}
              aria-expanded={open}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                groupActive
                  ? "text-foreground"
                  : "text-muted hover:bg-accent-soft hover:text-foreground"
              }`}
            >
              <ChevronDown
                size={13}
                className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
              />
              {g.label}
              {groupActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </button>
            {open && <div className="mt-0.5 space-y-0.5 pl-2">{g.items.map(renderItem)}</div>}
          </div>
        );
      })}
    </nav>
  );
}
