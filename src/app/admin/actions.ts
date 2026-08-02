"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import {
  POST_STATUS,
  COMMENT_STATUS,
  COMMENT_STATUS_LABEL,
  ROLE,
  ROLE_LABEL,
  canAdmin,
  canManagePosts,
} from "@/lib/constants";
import { slugify } from "@/lib/utils";
import { getSetting } from "@/lib/settings";
import { generateApiKey } from "@/lib/api-key";
import { WIDGET_TYPES, WIDGET_TYPE_LABEL, WidgetType } from "@/lib/widget-constants";
import {
  createBackupFile,
  restoreBackupFile,
  safeBackupPath,
} from "@/lib/backup";
import fs from "node:fs";
import path from "node:path";
import { doAction, postPayload } from "@/lib/hooks";
import { refreshPluginPages, PAGE_TEMPLATE_KEY } from "@/lib/plugin-pages";
import { deleteFromCloud } from "@/lib/plugin-storage";
import { PAGE_TEMPLATE_NAME_RE } from "@/lib/theme";

// ---------- 权限守卫 ----------
async function guardCanManagePosts() {
  const user = await requireApiUser();
  if (!user) redirect("/login");
  if (!canManagePosts(user.role)) {
    throw new Error("没有权限执行此操作");
  }
  return user;
}

// ---------- 文章 ----------
const postSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(255),
  slug: z.string().max(255).optional(),
  excerpt: z.string().max(500).optional().default(""),
  content: z.string().min(1, "内容不能为空"),
  coverUrl: z.string().max(500).nullable().optional(),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  tagIds: z.array(z.coerce.number().int().positive()).optional().default([]),
  // 编辑页直接输入的新标签/新分类（不存在则创建，已存在则复用）
  newTags: z.array(z.string().trim().min(1).max(100)).optional().default([]),
  newCategory: z.string().trim().max(100).nullable().optional(),
  isPinned: z.boolean().optional().default(false),
  action: z.enum(["draft", "publish", "schedule", "auto"]),
  scheduledAt: z.string().optional().nullable(),
  // 高级属性
  password: z.string().max(100).nullable().optional(), // 访问密码（明文，服务端 bcrypt）
  removePassword: z.boolean().optional().default(false), // 编辑时勾选则移除密码
  externalUrl: z.string().max(500).nullable().optional(), // 外链跳转地址
  categoryPinned: z.boolean().optional().default(false), // 分类内置顶
  customFields: z
    .array(z.object({ key: z.string().trim().max(50), value: z.string().trim().max(500) }))
    .optional()
    .default([]), // 自定义字段 [{key, value}]
});

// 从 Markdown 提取纯文本摘要（取前 180 字，同 emlog 的自动摘要）
function extractSummary(md: string, max = 180): string {
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)\s]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)\s]*\)/g, "$1")
    .replace(/[#>*_`~\-|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, max);
}

// 从 Markdown 提取第一张图片 URL（自动封面）
function extractCover(md: string): string | null {
  const m = md.match(/!\[[^\]]*\]\(([^)\s]+)\)/);
  return m ? m[1] : null;
}

// 摘要/封面留空时自动填充（不覆盖用户手动填写的内容）
function fillExcerptCover(data: { excerpt?: string; coverUrl?: string | null; content: string }) {
  return {
    excerpt: data.excerpt?.trim() ? data.excerpt.trim() : extractSummary(data.content),
    coverUrl: data.coverUrl?.trim() ? data.coverUrl.trim() : extractCover(data.content),
  };
}

// 自定义字段 → JSON 文本（过滤 key/value 均空的空行）
function serializeCustomFields(fields: { key: string; value: string }[]): string | null {
  const clean = fields.filter((f) => f.key.trim() || f.value.trim());
  return clean.length ? JSON.stringify(clean) : null;
}

// 编辑页输入的新标签：已存在则复用，否则创建（slug 冲突自动加后缀）
async function resolveNewTags(names: string[]): Promise<bigint[]> {
  const ids: bigint[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const existing = await prisma.tag.findUnique({ where: { name } });
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const slug = await resolveUniqueSlug(slugify(name), async (s) =>
      Boolean(await prisma.tag.findUnique({ where: { slug: s } }))
    );
    const created = await prisma.tag.create({ data: { name, slug } });
    ids.push(created.id);
  }
  return ids;
}

// 编辑页输入的新分类：已存在则复用，否则创建顶级分类
async function resolveNewCategory(name: string | null | undefined): Promise<bigint | null> {
  const n = name?.trim();
  if (!n) return null;
  const existing = await prisma.category.findUnique({ where: { name: n } });
  if (existing) return existing.id;
  const slug = await resolveUniqueSlug(slugify(n), async (s) =>
    Boolean(await prisma.category.findUnique({ where: { slug: s } }))
  );
  const created = await prisma.category.create({ data: { name: n, slug } });
  return created.id;
}

// 合并已有标签 id 与新建标签，得到最终关联的标签 id 列表
async function resolvePostTags(tagIds: number[], newTags: string[]): Promise<bigint[]> {
  const ids = tagIds.map((id) => BigInt(id));
  ids.push(...(await resolveNewTags(newTags)));
  return ids;
}

export async function createPost(input: z.input<typeof postSchema>) {
  const user = await guardCanManagePosts();
  const data = postSchema.parse(input);

  const slug = data.slug?.trim() || slugify(data.title);

  let status: string = POST_STATUS.DRAFT;
  let publishedAt: Date | null = null;
  if (data.action === "publish") {
    status = POST_STATUS.PUBLISHED;
    publishedAt = new Date();
  } else if (data.action === "schedule") {
    if (!data.scheduledAt) throw new Error("定时发布需要选择时间");
    const at = new Date(data.scheduledAt);
    if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
      throw new Error("定时发布时间必须晚于当前时间");
    }
    status = POST_STATUS.SCHEDULED;
    publishedAt = at;
  }

  const { excerpt, coverUrl } = fillExcerptCover(data);
  const tagIds = await resolvePostTags(data.tagIds, data.newTags);
  const categoryId = (await resolveNewCategory(data.newCategory)) ?? (data.categoryId ? BigInt(data.categoryId) : null);

  const post = await prisma.post.create({
    data: {
      title: data.title,
      slug,
      excerpt,
      content: data.content,
      coverUrl,
      status,
      publishedAt,
      isPinned: data.isPinned,
      authorId: user.id,
      categoryId,
      password: data.password?.trim() ? await hash(data.password.trim(), 10) : null,
      externalUrl: data.externalUrl?.trim() || null,
      categoryPinned: data.categoryPinned,
      customFields: serializeCustomFields(data.customFields),
      tags: {
        create: tagIds.map((tagId) => ({ tagId })),
      },
    },
  });

  // 钩子：文章创建后（插件可在此接通知、对接第三方等）
  await doAction("after_create_post", postPayload(post));

  revalidatePath("/");
  revalidatePath("/admin/posts");

  redirect(`/admin/posts/${post.id}/edit`);
}

export async function updatePost(id: bigint, input: z.input<typeof postSchema>) {
  const user = await guardCanManagePosts();
  const data = postSchema.parse(input);

  const slug = data.slug?.trim() || slugify(data.title);

  let status: string | undefined = data.action === "draft" ? POST_STATUS.DRAFT : undefined;
  let publishedAt: Date | null | undefined;

  if (data.action === "publish") {
    status = POST_STATUS.PUBLISHED;
    publishedAt = new Date();
  } else if (data.action === "schedule") {
    if (!data.scheduledAt) throw new Error("定时发布需要选择时间");
    const at = new Date(data.scheduledAt);
    if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
      throw new Error("定时发布时间必须晚于当前时间");
    }
    status = POST_STATUS.SCHEDULED;
    publishedAt = at;
  }

  const postId = id;
  const existing = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true },
  });
  if (!existing) throw new Error("文章不存在");

  // 编辑时保留原文状态（draft 动作显式转草稿）
  if (status === undefined) {
    const cur = await prisma.post.findUnique({
      where: { id: postId },
      select: { status: true },
    });
    status = cur?.status ?? POST_STATUS.DRAFT;
  }

  const { excerpt, coverUrl } = fillExcerptCover(data);
  const tagIds = await resolvePostTags(data.tagIds, data.newTags);
  const categoryId = (await resolveNewCategory(data.newCategory)) ?? (data.categoryId ? BigInt(data.categoryId) : null);

  // 密码：填了新值 → 重新哈希；勾选移除 → 清空；都无 → 保持不变
  let password: string | null | undefined;
  if (data.password?.trim()) {
    password = await hash(data.password.trim(), 10);
  } else if (data.removePassword) {
    password = null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.postTag.deleteMany({ where: { postId } });
    await tx.post.update({
      where: { id: postId },
      data: {
        title: data.title,
        slug,
        excerpt,
        content: data.content,
        coverUrl,
        status,
        isPinned: data.isPinned,
        ...(password !== undefined ? { password } : {}),
        externalUrl: data.externalUrl?.trim() || null,
        categoryPinned: data.categoryPinned,
        customFields: serializeCustomFields(data.customFields),
        ...(publishedAt !== undefined ? { publishedAt } : {}),
        categoryId,
        tags: {
          create: tagIds.map((tagId) => ({ tagId })),
        },
      },
    });
  });

  // 钩子：文章更新后
  await doAction("after_update_post", postPayload({
    id: postId,
    title: data.title,
    slug,
    status: status ?? POST_STATUS.DRAFT,
    publishedAt: publishedAt ?? null,
    categoryId,
    externalUrl: data.externalUrl?.trim() || null,
    isPinned: data.isPinned,
    categoryPinned: data.categoryPinned,
  }));

  revalidatePath("/");
  revalidatePath("/admin/posts");
  revalidatePath(`/post/${slug}`);

}

// 移入回收站（软删除）：前台立即不可见，可在回收站恢复或彻底删除
export async function deletePost(id: bigint) {
  const user = await guardCanManagePosts();
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw new Error("文章不存在");
  await prisma.post.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  // 钩子：文章移入回收站
  await doAction("after_delete_post", postPayload(post));
  revalidatePath("/");
  revalidatePath("/admin/posts");

}

// 从回收站恢复
export async function restorePost(id: bigint) {
  const user = await guardCanManagePosts();
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw new Error("文章不存在");
  await prisma.post.update({
    where: { id },
    data: { deletedAt: null },
  });
  revalidatePath("/");
  revalidatePath("/admin/posts");

}

// 从回收站彻底删除（不可恢复）
export async function purgePost(id: bigint) {
  const user = await guardCanManagePosts();
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw new Error("文章不存在");
  await prisma.post.delete({ where: { id } });
  // 钩子：文章彻底删除
  await doAction("after_purge_post", postPayload(post));
  revalidatePath("/");
  revalidatePath("/admin/posts");

}

// ---------- 文章批量操作 ----------
const BATCH_OP_LABEL: Record<string, string> = {
  publish: "立即发布",
  draft: "转草稿",
  pin: "置顶",
  unpin: "取消置顶",
  delete: "删除",
  move: "移动分类",
};

// ids: 文章 id 字符串数组；op: publish/draft/pin/unpin/delete/move/restore/purge；move 时 categoryId 传分类 id 或空串（未分类）
export async function batchUpdatePosts(
  ids: string[],
  op: "publish" | "draft" | "pin" | "unpin" | "delete" | "move" | "restore" | "purge",
  categoryId?: string
) {
  const user = await guardCanManagePosts();
  const list = [...new Set(ids)].slice(0, 100).map((i) => BigInt(i));
  if (list.length === 0) throw new Error("未选择文章");

  let moveTarget: string | null = null;
  switch (op) {
    case "publish":
      await prisma.post.updateMany({
        where: { id: { in: list } },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
      break;
    case "draft":
      await prisma.post.updateMany({
        where: { id: { in: list } },
        data: { status: "DRAFT", publishedAt: null },
      });
      break;
    case "pin":
      await prisma.post.updateMany({
        where: { id: { in: list } },
        data: { isPinned: true },
      });
      break;
    case "unpin":
      await prisma.post.updateMany({
        where: { id: { in: list } },
        data: { isPinned: false },
      });
      break;
    case "delete":
      // 批量移入回收站（软删除，可在回收站恢复）
      await prisma.post.updateMany({
        where: { id: { in: list } },
        data: { deletedAt: new Date() },
      });
      break;
    case "restore":
      await prisma.post.updateMany({
        where: { id: { in: list } },
        data: { deletedAt: null },
      });
      break;
    case "purge":
      // 彻底删除：仅回收站内的文章
      await prisma.post.deleteMany({
        where: { id: { in: list }, deletedAt: { not: null } },
      });
      break;
    case "move": {
      const cid = categoryId ? BigInt(categoryId) : null;
      if (cid) {
        const cat = await prisma.category.findUnique({
          where: { id: cid },
          select: { id: true, name: true },
        });
        if (!cat) throw new Error("分类不存在");
        moveTarget = cat.name;
      } else {
        moveTarget = "未分类";
      }
      await prisma.post.updateMany({
        where: { id: { in: list } },
        data: { categoryId: cid },
      });
      break;
    }
  }

  revalidatePath("/");
  revalidatePath("/admin/posts");

}

// ---------- 独立页面 ----------
const pageSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(100),
  slug: z.string().max(100),
  content: z.string(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  template: z.string().regex(PAGE_TEMPLATE_NAME_RE, "模板名不合法").default("default"),
});

export type PageInput = z.infer<typeof pageSchema>;

// 页面地址：用户填写，空则按标题自动生成；冲突自动加 -N 后缀
async function resolvePageSlug(input: { slug: string; title: string }, excludeId?: bigint) {
  const base = slugify(input.slug || input.title);
  if (!base) throw new Error("页面地址不能为空");
  return resolveUniqueSlug(base, async (s) =>
    Boolean(
      await prisma.page.findFirst({
        where: { slug: s, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { id: true },
      })
    )
  );
}

export async function createPage(input: PageInput) {
  const user = await guardCanManagePosts();
  const data = pageSchema.parse(input);
  const slug = await resolvePageSlug(data);
  const page = await prisma.page.create({
    data: {
      title: data.title,
      slug,
      content: data.content,
      status: data.status,
      template: data.template,
      publishedAt: data.status === "PUBLISHED" ? new Date() : null,
    },
  });
  revalidatePath("/");
  revalidatePath("/admin/pages");
  // 已发布页面重渲染插件模板缓存
  if (data.status === "PUBLISHED") await refreshPluginPages();

  return { id: String(page.id) };
}

export async function updatePage(id: string, input: PageInput) {
  const user = await guardCanManagePosts();
  const data = pageSchema.parse(input);
  const pageId = BigInt(id);
  const existing = await prisma.page.findUnique({ where: { id: pageId } });
  if (!existing) throw new Error("页面不存在");
  const slug = await resolvePageSlug(data, pageId);
  await prisma.page.update({
    where: { id: pageId },
    data: {
      title: data.title,
      slug,
      content: data.content,
      status: data.status,
      template: data.template,
      publishedAt:
        data.status === "PUBLISHED"
          ? existing.publishedAt ?? new Date()
          : null,
    },
  });
  revalidatePath("/");
  revalidatePath("/admin/pages");
  // 页面内容/模板变更后重渲染模板缓存（发布状态页面）
  await refreshPluginPages();
}

export async function deletePage(id: bigint) {
  const user = await guardCanManagePosts();
  const page = await prisma.page.findUnique({ where: { id } });
  if (!page) throw new Error("页面不存在");
  // 删除设为首页的页面时清除首页设置
  if ((await getSetting("home_page_id", "")) === String(id)) {
    await prisma.setting.deleteMany({ where: { key: "home_page_id" } });
  }
  await prisma.page.delete({ where: { id: page.id } });
  // 清理该页面的插件模板缓存
  await prisma.setting.deleteMany({ where: { key: PAGE_TEMPLATE_KEY(page.slug) } });
  revalidatePath("/");
  revalidatePath("/admin/pages");
}

// 设为首页（null 取消）
export async function setHomePage(pageId: string | null) {
  const user = await guardCanManagePosts();
  if (pageId) {
    const page = await prisma.page.findUnique({ where: { id: BigInt(pageId) } });
    if (!page) throw new Error("页面不存在");
    await prisma.setting.upsert({
      where: { key: "home_page_id" },
      update: { value: pageId },
      create: { key: "home_page_id", value: pageId },
    });
  } else {
    await prisma.setting.deleteMany({ where: { key: "home_page_id" } });
  }
  revalidatePath("/");
  revalidatePath("/admin/pages");

}

// ---------- 友情链接 ----------
const linkSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100),
  url: z.string().min(1, "地址不能为空").max(500),
  description: z.string().max(255).optional().default(""),
});

export async function createLink(input: z.infer<typeof linkSchema>) {
  const user = await guardCanManagePosts();
  const data = linkSchema.parse(input);
  const max = await prisma.link.aggregate({ _max: { sortOrder: true } });
  await prisma.link.create({
    data: {
      name: data.name,
      url: data.url,
      description: data.description || null,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/");
  revalidatePath("/admin/links");

}

export async function updateLink(id: string, input: z.infer<typeof linkSchema>) {
  const user = await guardCanManagePosts();
  const data = linkSchema.parse(input);
  const link = await prisma.link.findUnique({ where: { id: BigInt(id) } });
  if (!link) throw new Error("链接不存在");
  await prisma.link.update({
    where: { id: link.id },
    data: {
      name: data.name,
      url: data.url,
      description: data.description || null,
    },
  });
  revalidatePath("/");
  revalidatePath("/admin/links");

}

export async function deleteLink(id: bigint) {
  const user = await guardCanManagePosts();
  const link = await prisma.link.findUnique({ where: { id } });
  if (!link) throw new Error("链接不存在");
  await prisma.link.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/admin/links");

}

export async function toggleLinkVisible(id: bigint) {
  const user = await guardCanManagePosts();
  const link = await prisma.link.findUnique({ where: { id } });
  if (!link) throw new Error("链接不存在");
  await prisma.link.update({
    where: { id },
    data: { visible: !link.visible },
  });
  revalidatePath("/");
  revalidatePath("/admin/links");

}

// 上移/下移（交换相邻链接的排序值）
export async function moveLink(id: bigint, dir: "up" | "down") {
  const user = await guardCanManagePosts();
  const link = await prisma.link.findUnique({ where: { id } });
  if (!link) throw new Error("链接不存在");
  const neighbor = await prisma.link.findFirst({
    where: dir === "up" ? { sortOrder: { lt: link.sortOrder } } : { sortOrder: { gt: link.sortOrder } },
    orderBy: dir === "up" ? { sortOrder: "desc" } : { sortOrder: "asc" },
  });
  if (!neighbor) return; // 已在边界
  await prisma.$transaction([
    prisma.link.update({ where: { id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.link.update({ where: { id: neighbor.id }, data: { sortOrder: link.sortOrder } }),
  ]);
  revalidatePath("/");
  revalidatePath("/admin/links");

}

// ---------- 分类 ----------
const categorySchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100),
  slug: z.string().max(100).optional(),
  description: z.string().max(500).optional().default(""),
  parentId: z.coerce.number().int().positive().nullable().optional(),
});

// 收集某分类的所有后代 id（BFS）
async function collectDescendantIds(categoryId: bigint): Promise<bigint[]> {
  const ids: bigint[] = [];
  let queue = [categoryId];
  while (queue.length > 0) {
    const children = await prisma.category.findMany({
      where: { parentId: { in: queue } },
      select: { id: true },
    });
    queue = children.map((c) => c.id);
    ids.push(...queue);
  }
  return ids;
}

// 校验父分类：存在且不是自己/自己的后代
async function assertValidParent(
  categoryId: bigint | number,
  parentId: bigint | number | null
): Promise<void> {
  if (!parentId) return;
  const cid = BigInt(categoryId);
  const pid = BigInt(parentId);
  if (pid === cid) throw new Error("父分类不能是自己");
  const parent = await prisma.category.findUnique({ where: { id: pid } });
  if (!parent) throw new Error("父分类不存在");
  const descendants = await collectDescendantIds(cid);
  if (descendants.some((id) => id === pid)) {
    throw new Error("不能选择自己的子分类作为父分类");
  }
}

export async function createCategory(input: z.input<typeof categorySchema>) {
  const user = await guardCanManagePosts();
  const data = categorySchema.parse(input);
  if (data.parentId) {
    await assertValidParent(BigInt(0), data.parentId);
  }
  const base = slugify(data.slug || data.name);
  const slug = await resolveUniqueSlug(base, async (s) =>
    Boolean(await prisma.category.findUnique({ where: { slug: s } }))
  );
  const max = await prisma.category.aggregate({
    _max: { sortOrder: true },
    where: { parentId: data.parentId ? BigInt(data.parentId) : null },
  });
  await prisma.category.create({
    data: {
      name: data.name,
      slug,
      description: data.description || null,
      parentId: data.parentId ? BigInt(data.parentId) : null,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/admin/categories");

}

export async function updateCategory(id: bigint, input: z.input<typeof categorySchema>) {
  const user = await guardCanManagePosts();
  const data = categorySchema.parse(input);
  await assertValidParent(id, data.parentId ? BigInt(data.parentId) : null);
  const base = slugify(data.slug || data.name);
  const slug = await resolveUniqueSlug(base, async (s) =>
    Boolean(await prisma.category.findFirst({ where: { slug: s, NOT: { id } } }))
  );
  await prisma.category.update({
    where: { id },
    data: {
      name: data.name,
      slug,
      description: data.description || null,
      parentId: data.parentId ? BigInt(data.parentId) : null,
    },
  });
  revalidatePath("/admin/categories");

}

export async function deleteCategory(id: bigint) {
  const user = await guardCanManagePosts();
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new Error("分类不存在");
  await prisma.$transaction([
    // 子分类提升为顶级，避免孤儿
    prisma.category.updateMany({ where: { parentId: id }, data: { parentId: null } }),
    prisma.category.delete({ where: { id } }),
  ]);
  revalidatePath("/admin/categories");

}

// 同级排序：上移/下移（与相邻同级分类交换 sortOrder）
export async function moveCategory(id: bigint, dir: "up" | "down") {
  const user = await guardCanManagePosts();
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new Error("分类不存在");
  const neighbor = await prisma.category.findFirst({
    where: {
      parentId: category.parentId,
      ...(dir === "up"
        ? { sortOrder: { lt: category.sortOrder } }
        : { sortOrder: { gt: category.sortOrder } }),
    },
    orderBy: dir === "up" ? { sortOrder: "desc" } : { sortOrder: "asc" },
  });
  if (!neighbor) return; // 已在边界
  await prisma.$transaction([
    prisma.category.update({ where: { id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.category.update({ where: { id: neighbor.id }, data: { sortOrder: category.sortOrder } }),
  ]);
  revalidatePath("/admin/categories");

}

// ---------- 标签 ----------
const tagSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100),
  slug: z.string().max(100).optional(),
});

// slug 冲突时自动追加 -N 后缀（emlog 风格），避免唯一约束报错
async function resolveUniqueSlug(
  slug: string,
  check: (s: string) => Promise<boolean>,
  maxAttempts = 50
): Promise<string> {
  let candidate = slug;
  for (let i = 2; i <= maxAttempts; i++) {
    if (!(await check(candidate))) return candidate;
    candidate = `${slug}-${i}`;
  }
  return candidate;
}

export async function createTag(input: z.input<typeof tagSchema>) {
  const user = await guardCanManagePosts();
  const data = tagSchema.parse(input);
  const base = slugify(data.slug || data.name);
  const slug = await resolveUniqueSlug(base, async (s) =>
    Boolean(await prisma.tag.findUnique({ where: { slug: s } }))
  );
  await prisma.tag.create({
    data: { name: data.name, slug },
  });
  revalidatePath("/admin/tags");
  revalidatePath("/", "layout");

}

export async function updateTag(id: bigint, input: z.input<typeof tagSchema>) {
  const user = await guardCanManagePosts();
  const data = tagSchema.parse(input);
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) throw new Error("标签不存在");
  const base = slugify(data.slug || data.name);
  const slug = await resolveUniqueSlug(base, async (s) =>
    Boolean(await prisma.tag.findFirst({ where: { slug: s, NOT: { id } } }))
  );
  await prisma.tag.update({
    where: { id },
    data: { name: data.name, slug },
  });
  revalidatePath("/admin/tags");
  revalidatePath("/", "layout");

}

export async function deleteTag(id: bigint) {
  const user = await guardCanManagePosts();
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) throw new Error("标签不存在");
  await prisma.tag.delete({ where: { id } });
  revalidatePath("/admin/tags");
  revalidatePath("/", "layout");

}

// ---------- 评论审核 ----------
export async function setCommentStatus(id: bigint | string, status: string) {
  const user = await guardCanManagePosts();
  if (!Object.values(COMMENT_STATUS).includes(status as never)) {
    throw new Error("无效的评论状态");
  }
  const cid = BigInt(id);
  const before = await prisma.comment.findUnique({
    where: { id: cid },
    select: { id: true, postId: true, status: true },
  });
  if (!before) throw new Error("评论不存在");
  await prisma.comment.update({ where: { id: cid }, data: { status } });
  // 钩子：评论状态变更
  await doAction("after_comment_status", {
    id: String(cid),
    postId: String(before.postId),
    from: before.status,
    to: status,
  });
  revalidatePath("/admin/comments");
  revalidatePath("/");

}

export async function deleteComment(id: bigint) {
  const user = await guardCanManagePosts();
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, authorName: true },
  });
  await prisma.comment.delete({ where: { id } });
  // 钩子：评论删除
  await doAction("after_comment_delete", {
    id: String(id),
    authorName: comment?.authorName ?? "",
  });
  revalidatePath("/admin/comments");

}

// 置顶/取消置顶（前台文章页优先展示）
export async function setCommentPinned(id: bigint, pinned: boolean) {
  const user = await guardCanManagePosts();
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, authorName: true },
  });
  if (!comment) throw new Error("评论不存在");
  await prisma.comment.update({ where: { id }, data: { isPinned: pinned } });
  revalidatePath("/admin/comments");
  revalidatePath("/post", "layout");

}

// 按 IP 删除该 IP 的全部评论
export async function deleteCommentsByIp(ip: string) {
  const user = await guardCanManagePosts();
  const ipTrim = ip.trim();
  if (!ipTrim) throw new Error("IP 不能为空");
  const { count } = await prisma.comment.deleteMany({ where: { ip: ipTrim } });
  revalidatePath("/admin/comments");

  return count;
}

// 管理员直接回复评论：以管理员身份创建已通过的子评论，前台回复树自动展示
export async function replyComment(commentId: bigint | string, content: string) {
  const user = await guardCanManagePosts();
  const text = content.trim();
  if (!text) throw new Error("回复内容不能为空");
  if (text.length > 2000) throw new Error("回复内容过长（最多 2000 字）");
  const parent = await prisma.comment.findUnique({
    where: { id: BigInt(commentId) },
    select: { id: true, postId: true },
  });
  if (!parent) throw new Error("评论不存在");
  await prisma.comment.create({
    data: {
      postId: parent.postId,
      parentId: parent.id,
      userId: user.id,
      authorName: user.username,
      authorEmail: "",
      content: text,
      status: COMMENT_STATUS.APPROVED,
    },
  });
  // 钩子：管理员回复评论
  await doAction("after_comment_reply", {
    parentId: String(parent.id),
    postId: String(parent.postId),
    author: user.username,
    content: text,
  });
  revalidatePath("/admin/comments");
  revalidatePath("/post", "layout");
  revalidatePath("/");
}

// 拉黑 IP：写入 settings.blocked_ips（JSON 数组），该 IP 之后的评论提交被 403 拒绝
export async function blockIp(ip: string) {
  const user = await guardCanManagePosts();
  const ipTrim = ip.trim();
  if (!ipTrim) throw new Error("IP 不能为空");
  let list: string[] = [];
  try {
    const parsed = JSON.parse(await getSetting("blocked_ips", "[]"));
    if (Array.isArray(parsed)) list = parsed;
  } catch {
    list = [];
  }
  if (!list.includes(ipTrim)) list.push(ipTrim);
  await prisma.setting.upsert({
    where: { key: "blocked_ips" },
    update: { value: JSON.stringify(list) },
    create: { key: "blocked_ips", value: JSON.stringify(list) },
  });
  revalidatePath("/admin/comments");
  revalidatePath("/admin/settings");
}

// ---------- 通知 ----------
export async function markNotificationRead(id: bigint) {
  await guardCanManagePosts();
  await prisma.notification.update({ where: { id }, data: { read: true } });
  revalidatePath("/admin/notifications");
  revalidatePath("/admin", "layout");
}

export async function markAllNotificationsRead() {
  await guardCanManagePosts();
  await prisma.notification.updateMany({ where: { read: false }, data: { read: true } });
  revalidatePath("/admin/notifications");
  revalidatePath("/admin", "layout");
}

// ---------- 设置 ----------
// 重新生成开放 API Key（立即生效，旧 Key 作废）
export async function regenerateApiKey() {
  const user = await guardCanManagePosts();
  const key = generateApiKey();
  await prisma.setting.upsert({
    where: { key: "api_key" },
    update: { value: key },
    create: { key: "api_key", value: key },
  });
  revalidatePath("/admin/settings");

  return key;
}

export async function updateSettings(input: Record<string, string>) {
  const user = await guardCanManagePosts();
  const allowed = new Set([
    "site_name",
    "site_subtitle",
    "site_description",
    "comments_enabled",
    "comments_need_review",
    "posts_per_page",
    "site_icp",
    "allow_registration",
    "notify_email_enabled",
    "notify_email",
    "blocked_ips",
    "api_enabled",
    "api_key",
    "store_url",
    "store_token",
  ]);
  const entries = Object.entries(input).filter(([k]) => allowed.has(k));
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    )
  );
  revalidatePath("/");

  revalidatePath("/admin/settings");
}

// ---------- 用户 ----------
export async function updateUserRole(id: bigint, role: string) {  const me = await requireApiUser();
  if (!me || !canAdmin(me.role)) throw new Error("仅管理员可操作");
  if (!Object.values(ROLE).includes(role as never)) throw new Error("无效角色");
  const target = await prisma.user.findUnique({
    where: { id },
    select: { username: true, role: true },
  });
  if (!target) throw new Error("用户不存在");
  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/admin/users");

}

// 禁用/解禁用户（不能操作自己；被禁用户登录被拒，重置令牌失效）
export async function toggleUserDisabled(id: bigint, disabled: boolean) {
  const me = await requireApiUser();
  if (!me || !canAdmin(me.role)) throw new Error("仅管理员可操作");
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true },
  });
  if (!target) throw new Error("用户不存在");
  if (target.id === me.id) throw new Error("不能禁用自己的账号");
  await prisma.user.update({
    where: { id },
    data: {
      disabled,
      // 禁用时吊销未使用的重置令牌
      ...(disabled ? { resetToken: null, resetTokenExpires: null } : {}),
    },
  });
  revalidatePath("/admin/users");

}

// 管理员重置指定用户密码
export async function resetUserPassword(id: bigint, newPassword: string) {
  const me = await requireApiUser();
  if (!me || !canAdmin(me.role)) throw new Error("仅管理员可操作");
  if (newPassword.length < 6 || newPassword.length > 72) {
    throw new Error("密码长度需 6-72 位");
  }
  const target = await prisma.user.findUnique({
    where: { id },
    select: { username: true },
  });
  if (!target) throw new Error("用户不存在");
  const bcrypt = await import("bcryptjs");
  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 10),
      resetToken: null,
      resetTokenExpires: null,
    },
  });
  revalidatePath("/admin/users");

}

// ---------- 个人资料 ----------
const profileSchema = z.object({
  nickname: z.string().max(50).optional().default(""),
  username: z.string().regex(/^[\w\u4e00-\u9fa5-]{2,50}$/, "用户名需 2-50 位，仅限中文、字母、数字、下划线和连字符"),
  email: z.string().email("邮箱格式不正确").max(255),
  avatarUrl: z.string().max(500).optional().default(""),
});

// 修改本人资料（昵称/用户名/邮箱/头像）；username、email 查重
export async function updateProfile(input: z.input<typeof profileSchema>) {
  const me = await requireApiUser();
  if (!me) redirect("/login");
  const data = profileSchema.parse(input);

  const dup = await prisma.user.findFirst({
    where: {
      OR: [{ username: data.username }, { email: data.email }],
      NOT: { id: me.id },
    },
    select: { username: true },
  });
  if (dup) {
    throw new Error(dup.username === data.username ? "用户名已被占用" : "邮箱已被注册");
  }

  const changed: string[] = [];
  const before = await prisma.user.findUnique({
    where: { id: me.id },
    select: { nickname: true, username: true, email: true, avatarUrl: true },
  });
  if (before) {
    if ((before.nickname ?? "") !== data.nickname.trim()) changed.push("昵称");
    if (before.username !== data.username) changed.push("用户名");
    if (before.email !== data.email) changed.push("邮箱");
    if ((before.avatarUrl ?? "") !== data.avatarUrl.trim()) changed.push("头像");
  }

  await prisma.user.update({
    where: { id: me.id },
    data: {
      nickname: data.nickname.trim() || null,
      username: data.username,
      email: data.email,
      avatarUrl: data.avatarUrl.trim() || null,
    },
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/profile");
  revalidatePath("/admin/users");

}

// 修改本人密码（需验证旧密码）
export async function changePassword(input: {
  oldPassword: string;
  newPassword: string;
}) {
  const me = await requireApiUser();
  if (!me) redirect("/login");
  const oldPassword = String(input.oldPassword ?? "");
  const newPassword = String(input.newPassword ?? "");
  if (!oldPassword) throw new Error("请输入当前密码");
  if (newPassword.length < 6 || newPassword.length > 72) {
    throw new Error("新密码长度需 6-72 位");
  }
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { passwordHash: true },
  });
  if (!user) throw new Error("用户不存在");
  const bcrypt = await import("bcryptjs");
  if (!(await bcrypt.compare(oldPassword, user.passwordHash))) {
    throw new Error("当前密码不正确");
  }
  await prisma.user.update({
    where: { id: me.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 10),
      resetToken: null,
      resetTokenExpires: null,
    },
  });

}

// ---------- 导航菜单 ----------
const navItemSchema = z.object({
  label: z.string().min(1, "名称不能为空").max(100),
  url: z.string().min(1, "地址不能为空").max(500),
  isExternal: z.boolean().optional().default(false),
});

export async function createNavItem(input: z.infer<typeof navItemSchema>) {
  const user = await guardCanManagePosts();
  const data = navItemSchema.parse(input);
  const max = await prisma.navItem.aggregate({ _max: { sortOrder: true } });
  await prisma.navItem.create({
    data: {
      label: data.label,
      url: data.url,
      isExternal: data.isExternal,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/", "layout");
  revalidatePath("/admin/nav");

}

export async function updateNavItem(id: bigint, input: z.infer<typeof navItemSchema>) {
  const user = await guardCanManagePosts();
  const data = navItemSchema.parse(input);
  const item = await prisma.navItem.findUnique({ where: { id } });
  if (!item) throw new Error("菜单项不存在");
  await prisma.navItem.update({
    where: { id },
    data: { label: data.label, url: data.url, isExternal: data.isExternal },
  });
  revalidatePath("/", "layout");
  revalidatePath("/admin/nav");

}

export async function deleteNavItem(id: bigint) {
  const user = await guardCanManagePosts();
  const item = await prisma.navItem.findUnique({ where: { id } });
  if (!item) throw new Error("菜单项不存在");
  await prisma.navItem.delete({ where: { id } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/nav");

}

export async function toggleNavVisible(id: bigint) {
  const user = await guardCanManagePosts();
  const item = await prisma.navItem.findUnique({ where: { id } });
  if (!item) throw new Error("菜单项不存在");
  await prisma.navItem.update({ where: { id }, data: { visible: !item.visible } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/nav");

}

// 上移/下移（交换相邻菜单项的排序值）
export async function moveNavItem(id: bigint, dir: "up" | "down") {
  const user = await guardCanManagePosts();
  const item = await prisma.navItem.findUnique({ where: { id } });
  if (!item) throw new Error("菜单项不存在");
  const neighbor = await prisma.navItem.findFirst({
    where: dir === "up" ? { sortOrder: { lt: item.sortOrder } } : { sortOrder: { gt: item.sortOrder } },
    orderBy: dir === "up" ? { sortOrder: "desc" } : { sortOrder: "asc" },
  });
  if (!neighbor) return; // 已在边界
  await prisma.$transaction([
    prisma.navItem.update({ where: { id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.navItem.update({ where: { id: neighbor.id }, data: { sortOrder: item.sortOrder } }),
  ]);
  revalidatePath("/", "layout");
  revalidatePath("/admin/nav");

}

// ---------- 侧边栏组件 ----------
const widgetSchema = z.object({
  type: z.enum(WIDGET_TYPES),
  title: z.string().max(100).optional().default(""),
  content: z.string().max(5000).optional().default(""),
});

export async function createWidget(input: z.infer<typeof widgetSchema>) {
  const user = await guardCanManagePosts();
  const data = widgetSchema.parse(input);
  const max = await prisma.widget.aggregate({ _max: { sortOrder: true } });
  await prisma.widget.create({
    data: {
      type: data.type,
      title: data.title?.trim() || null,
      content: data.type === "custom" ? data.content || null : null,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/", "layout");
  revalidatePath("/admin/widgets");

}

export async function updateWidget(id: bigint, input: z.infer<typeof widgetSchema>) {
  const user = await guardCanManagePosts();
  const data = widgetSchema.parse(input);
  const widget = await prisma.widget.findUnique({ where: { id } });
  if (!widget) throw new Error("组件不存在");
  await prisma.widget.update({
    where: { id },
    data: {
      type: data.type,
      title: data.title?.trim() || null,
      content: data.type === "custom" ? data.content || null : null,
    },
  });
  revalidatePath("/", "layout");
  revalidatePath("/admin/widgets");

}

export async function deleteWidget(id: bigint) {
  const user = await guardCanManagePosts();
  const widget = await prisma.widget.findUnique({ where: { id } });
  if (!widget) throw new Error("组件不存在");
  await prisma.widget.delete({ where: { id } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/widgets");

}

export async function toggleWidgetVisible(id: bigint) {
  const user = await guardCanManagePosts();
  const widget = await prisma.widget.findUnique({ where: { id } });
  if (!widget) throw new Error("组件不存在");
  await prisma.widget.update({ where: { id }, data: { visible: !widget.visible } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/widgets");

}

// 上移/下移（交换相邻组件的排序值）
export async function moveWidget(id: bigint, dir: "up" | "down") {
  const user = await guardCanManagePosts();
  const widget = await prisma.widget.findUnique({ where: { id } });
  if (!widget) throw new Error("组件不存在");
  const neighbor = await prisma.widget.findFirst({
    where: dir === "up" ? { sortOrder: { lt: widget.sortOrder } } : { sortOrder: { gt: widget.sortOrder } },
    orderBy: dir === "up" ? { sortOrder: "desc" } : { sortOrder: "asc" },
  });
  if (!neighbor) return; // 已在边界
  await prisma.$transaction([
    prisma.widget.update({ where: { id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.widget.update({ where: { id: neighbor.id }, data: { sortOrder: widget.sortOrder } }),
  ]);
  revalidatePath("/", "layout");
  revalidatePath("/admin/widgets");

}

// ---------- 数据备份 ----------
export async function createBackup() {
  const user = await requireApiUser();
  if (!user || !canAdmin(user.role)) throw new Error("仅管理员可操作");
  const { file, size } = await createBackupFile();

  revalidatePath("/admin/backup");
  return { file, size };
}

// 恢复备份：需输入备份文件名确认，恢复前自动留底
export async function restoreBackup(input: { file: string; confirm: string }) {
  const user = await requireApiUser();
  if (!user || !canAdmin(user.role)) throw new Error("仅管理员可操作");
  const file = input.file.trim();
  const target = safeBackupPath(file);
  if (!target) throw new Error("非法的备份文件名");
  if (input.confirm.trim() !== file) {
    throw new Error("确认名称与备份文件名不一致，已取消恢复");
  }
  const { file: safety } = await createBackupFile();
  await restoreBackupFile(file);

  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  return { restored: file, safety };
}

export async function deleteBackup(file: string) {
  const user = await requireApiUser();
  if (!user || !canAdmin(user.role)) throw new Error("仅管理员可操作");
  const target = safeBackupPath(file);
  if (!target) throw new Error("非法的备份文件名");
  if (file.startsWith("upload-")) throw new Error("上传的恢复文件不可直接删除，请恢复后手动清理");
  fs.unlinkSync(target);

  revalidatePath("/admin/backup");
}

// ---------- 图片文件库 ----------
// 删除图片：同时删除 uploads 记录与存储文件；已在文章中引用的图片会失效（不可恢复）
export async function deleteUpload(id: bigint) {
  const user = await guardCanManagePosts();
  const up = await prisma.upload.findUnique({ where: { id } });
  if (!up) return;

  await prisma.upload.delete({ where: { id } });

  // 云端文件（完整 http(s) URL，云存储插件托管）→ 调插件删除；
  // 本地文件 → 仅删除 public/uploads 目录下的文件，防止路径穿越
  if (/^https?:\/\//i.test(up.url)) {
    await deleteFromCloud(up.url);
  } else {
    const base = path.resolve(process.cwd(), "public", "uploads");
    const target = path.resolve(process.cwd(), "public", up.url.replace(/^\//, ""));
    if (target.startsWith(base + path.sep) && target !== base) {
      await fs.promises.unlink(target).catch(() => {});
    }
  }

  revalidatePath("/admin/uploads");
}
