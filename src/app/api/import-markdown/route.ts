import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import { slugify } from "@/lib/utils";
import { revalidatePath } from "next/cache";

// 批量导入 Markdown 文件创建文章（支持 YAML frontmatter: title/date/tags）
const MAX_FILES = 50;
const MAX_FILE_SIZE = 1024 * 1024; // 单文件 1MB

// 解析 YAML frontmatter（key: value 子集）与正文
function parseFrontmatter(text: string): {
  title?: string;
  date?: string;
  tags?: string[];
  content: string;
} {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { content: text };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim();
  }
  const tags = meta.tags
    ? meta.tags.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean).slice(0, 5)
    : undefined;
  return {
    title: meta.title || undefined,
    date: meta.date || undefined,
    tags: tags && tags.length > 0 ? tags : undefined,
    content: text.slice(m[0].length).trim(),
  };
}

// slug 去冲突：已存在则追加 -2/-3…
async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let n = 2;
  while (await prisma.post.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

// 标签：按名复用或创建
async function resolveTagId(name: string): Promise<bigint> {
  const hit = await prisma.tag.findUnique({ where: { name }, select: { id: true } });
  if (hit) return hit.id;
  return (
    await prisma.tag.create({
      data: { name, slug: await uniqueSlug(slugify(name)) },
      select: { id: true },
    })
  ).id;
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (!user || !canManagePosts(user.role)) {
    return NextResponse.json({ error: "没有权限执行此操作" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File);
  const status = form?.get("status") === "publish" ? "PUBLISHED" : "DRAFT";
  if (files.length === 0) {
    return NextResponse.json({ error: "未选择 Markdown 文件" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `一次最多导入 ${MAX_FILES} 个文件` }, { status: 400 });
  }

  const results: { name: string; ok: boolean; error?: string }[] = [];
  let created = 0;

  for (const file of files) {
    const name = file.name;
    try {
      if (!name.toLowerCase().endsWith(".md")) {
        results.push({ name, ok: false, error: "仅支持 .md 文件" });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        results.push({ name, ok: false, error: "文件超过 1MB" });
        continue;
      }
      const text = await file.text();
      const { title, date, tags, content } = parseFrontmatter(text);
      const postTitle = (title || name.replace(/\.md$/i, "")).slice(0, 255);
      if (!content) {
        results.push({ name, ok: false, error: "正文为空" });
        continue;
      }

      // 标题重复的旧文章也会导致 slug 冲突，uniqueSlug 统一去冲突
      const slug = await uniqueSlug(slugify(postTitle));

      // 导入为发布状态时，优先使用 frontmatter 的 date 保留原发布时间
      let publishedAt: Date | null = null;
      if (status === "PUBLISHED") {
        publishedAt = date && !Number.isNaN(new Date(date).getTime())
          ? new Date(date)
          : new Date();
      }

      const tagIds = tags
        ? await Promise.all(tags.map((t) => resolveTagId(t).catch(() => null)))
        : [];

      await prisma.post.create({
        data: {
          title: postTitle,
          slug,
          excerpt: "",
          content,
          status,
          publishedAt,
          authorId: user.id,
          tags: {
            create: tagIds.filter((t): t is bigint => t !== null).map((tagId) => ({ tagId })),
          },
        },
      });
      created += 1;
      results.push({ name, ok: true });
    } catch (e) {
      results.push({
        name,
        ok: false,
        error: e instanceof Error ? e.message : "导入失败",
      });
    }
  }

  if (created > 0) {
    revalidatePath("/");
    revalidatePath("/admin/posts");
  }
  return NextResponse.json({
    created,
    failed: results.length - created,
    results,
  });
}
