import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 中文 slug：保留中文，转小写、空格转连字符
export function slugify(input: string): string {
  const s = input.trim().toLowerCase();
  const slug = s.replace(/\s+/g, "-").replace(/[^\w\u4e00-\u9fa5-]/g, "").replace(/-+/g, "-");
  return slug || `post-${Date.now()}`;
}

export function formatDate(date: Date | string | null | undefined, pattern = "yyyy-MM-dd") {
  if (!date) return "";
  return format(new Date(date), pattern, { locale: zhCN });
}

export function formatDateTime(date: Date | string | null | undefined) {
  return formatDate(date, "yyyy-MM-dd HH:mm");
}
