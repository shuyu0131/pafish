"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X, Search } from "lucide-react";

const linkClass =
  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-accent-soft hover:text-foreground";

export function MobileNav({
  loggedIn,
  items,
}: {
  loggedIn: boolean;
  items: { id: string; label: string; url: string; isExternal: boolean }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const kw = q.trim();
    if (!kw) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(kw)}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost !p-2 md:hidden"
        aria-label="打开菜单"
        title="打开菜单"
      >
        <Menu size={18} />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpen(false)}
            />
            <aside className="absolute inset-y-0 right-0 flex w-64 flex-col border-l border-border bg-card">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <span className="text-sm font-semibold tracking-tight">菜单</span>
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

            <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {items.map((l) => (
                <Link
                  key={l.id}
                  href={l.url}
                  target={l.isExternal ? "_blank" : undefined}
                  rel={l.isExternal ? "noreferrer" : undefined}
                  onClick={() => setOpen(false)}
                  className={linkClass}
                >
                  {l.label}
                </Link>
              ))}
              {items.length > 0 && <div className="my-2 border-t border-border" />}

              <form onSubmit={submit} className="mt-2 flex gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="搜索文章…"
                  aria-label="搜索文章"
                  className="input min-w-0 flex-1 !px-3 !py-2 !text-sm"
                />
                <button
                  type="submit"
                  className="btn btn-ghost !p-2"
                  aria-label="搜索"
                  title="搜索"
                >
                  <Search size={16} />
                </button>
              </form>
            </nav>

            <div className="border-t border-border p-3">
              {loggedIn ? (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="btn btn-primary w-full"
                >
                  登录
                </Link>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="btn btn-primary w-full"
                >
                  登录
                </Link>
              )}
            </div>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}
