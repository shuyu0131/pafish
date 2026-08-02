import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  // 显示页码窗口：当前页 ±2
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="分页">
      {page > 1 && (
        <Link
          href={buildHref(page - 1)}
          className="btn btn-outline !h-9 !w-9 !p-0"
          aria-label="上一页"
        >
          <ChevronLeft size={16} />
        </Link>
      )}
      {start > 1 && (
        <>
          <Link href={buildHref(1)} className="btn btn-outline !h-9 !w-9 !p-0 !text-sm">
            1
          </Link>
          {start > 2 && <span className="px-1 text-muted">…</span>}
        </>
      )}
      {pages.map((n) => (
        <Link
          key={n}
          href={buildHref(n)}
          aria-current={n === page ? "page" : undefined}
          className={
            n === page
              ? "btn btn-primary !h-9 !w-9 !p-0 !text-sm"
              : "btn btn-outline !h-9 !w-9 !p-0 !text-sm"
          }
        >
          {n}
        </Link>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-muted">…</span>}
          <Link
            href={buildHref(totalPages)}
            className="btn btn-outline !h-9 !w-9 !p-0 !text-sm"
          >
            {totalPages}
          </Link>
        </>
      )}
      {page < totalPages && (
        <Link
          href={buildHref(page + 1)}
          className="btn btn-outline !h-9 !w-9 !p-0"
          aria-label="下一页"
        >
          <ChevronRight size={16} />
        </Link>
      )}
    </nav>
  );
}
