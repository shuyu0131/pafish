"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavLinkItem {
  id: string;
  label: string;
  url: string;
  isExternal: boolean;
}

// 菜单项：由后台“导航菜单”配置，前台按顺序渲染
export function PublicNav({ items }: { items: NavLinkItem[] }) {
  const pathname = usePathname();
  if (items.length === 0) return null;
  return (
    <nav className="flex items-stretch gap-7 text-xs" aria-label="主导航">
      {items.map((l) => {
        const active =
          l.url === "/" ? pathname === "/" : pathname.startsWith(l.url);
        return (
          <Link
            key={l.id}
            href={l.url}
            target={l.isExternal ? "_blank" : undefined}
            rel={l.isExternal ? "noreferrer" : undefined}
            className={
              active
                ? "flex items-center border-b border-side font-medium text-foreground"
                : "flex items-center text-side transition-colors hover:text-accent"
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
