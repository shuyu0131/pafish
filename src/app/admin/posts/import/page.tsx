import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import { ImportMarkdown } from "@/components/admin/import-markdown";

export const metadata = { title: "导入 Markdown" };

export default async function ImportMarkdownPage() {
  const session = await requireSession();
  if (!canManagePosts(session.role)) {
    return (
      <p className="text-sm text-muted">没有权限执行此操作。</p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">导入 Markdown</h1>
        <p className="mt-1 text-sm text-muted">
          批量导入 .md 文件为文章，支持 YAML frontmatter（title / date / tags）
        </p>
      </div>

      <ImportMarkdown />

      <Link href="/admin/posts" className="btn btn-ghost !text-sm">
        ← 返回文章列表
      </Link>
    </div>
  );
}
