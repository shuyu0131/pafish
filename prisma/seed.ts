import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!, { useTextProtocol: true });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ---- 用户 ----
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      email: "admin@pafish.cn",
      passwordHash: await hash("Admin@12345", 12),
      role: "ADMIN",
    },
  });

  const editor = await prisma.user.upsert({
    where: { username: "editor" },
    update: {},
    create: {
      username: "editor",
      email: "editor@pafish.cn",
      passwordHash: await hash("Editor@12345", 12),
      role: "EDITOR",
    },
  });

  // ---- 分类 ----
  const tech = await prisma.category.upsert({
    where: { slug: "tech" },
    update: {},
    create: { name: "技术", slug: "tech", description: "编程、架构与工程实践" },
  });
  const life = await prisma.category.upsert({
    where: { slug: "life" },
    update: {},
    create: { name: "生活", slug: "life", description: "日常记录与思考" },
  });

  // ---- 标签 ----
  const tNext = await prisma.tag.upsert({
    where: { slug: "nextjs" },
    update: {},
    create: { name: "Next.js", slug: "nextjs" },
  });
  const tMysql = await prisma.tag.upsert({
    where: { slug: "mysql" },
    update: {},
    create: { name: "MySQL", slug: "mysql" },
  });
  const tDesign = await prisma.tag.upsert({
    where: { slug: "design" },
    update: {},
    create: { name: "设计", slug: "design" },
  });

  // ---- 示例文章 ----
  await prisma.post.upsert({
    where: { slug: "hello-pafish" },
    update: {},
    create: {
      title: "你好，纸鱼博客",
      slug: "hello-pafish",
      excerpt: "欢迎来到纸鱼博客！这是一篇示例文章，介绍本博客系统的能力。",
      content: `# 欢迎来到纸鱼博客

这是一篇由种子脚本创建的示例文章。

## 功能一览

- **Markdown 编辑**：后台使用 Markdown 编辑器
- **分类与标签**：灵活组织内容
- **全文搜索**：基于 MySQL ngram 中文分词
- **评论审核**：游客评论需审核后展示

\`\`\`ts
console.log("Hello, Pafish Blog!");
\`\`\`

感谢阅读！`,
      status: "PUBLISHED",
      publishedAt: new Date(),
      authorId: admin.id,
      categoryId: tech.id,
      tags: { create: [{ tagId: tNext.id }, { tagId: tMysql.id }] },
    },
  });

  await prisma.post.upsert({
    where: { slug: "minimalist-design-notes" },
    update: {},
    create: {
      title: "极简设计随笔",
      slug: "minimalist-design-notes",
      excerpt: "关于极简主义设计的一些思考：留白、对比与克制。",
      content: `# 极简设计随笔

好的设计是不打扰读者的设计。

## 留白

留白不是浪费，而是呼吸。

## 对比

对比制造层次，层次引导阅读。

> 少即是多。 —— Ludwig Mies van der Rohe`,
      status: "PUBLISHED",
      publishedAt: new Date(Date.now() - 86400000),
      authorId: editor.id,
      categoryId: life.id,
      tags: { create: [{ tagId: tDesign.id }] },
    },
  });

  await prisma.post.upsert({
    where: { slug: "draft-example" },
    update: {},
    create: {
      title: "一篇未完成的草稿",
      slug: "draft-example",
      excerpt: "这篇文章还在写作中……",
      content: "草稿内容，尚未发布。",
      status: "DRAFT",
      authorId: admin.id,
      categoryId: tech.id,
    },
  });

  // ---- 默认设置 ----
  const defaults: Record<string, string> = {
    site_name: "纸鱼博客",
    site_subtitle: "记录技术、设计与生活",
    site_description: "纸鱼博客是一个极简风格的博客系统",
    comments_enabled: "true",
    comments_need_review: "true",
    posts_per_page: "10",
    allow_registration: "true",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  // ---- 关于页迁移：about_content 设置已废弃，统一为 slug="about" 的自定义页面 ----
  const legacyAbout = await prisma.setting.findUnique({ where: { key: "about_content" } });
  if (legacyAbout) {
    const existingAbout = await prisma.page.findFirst({ where: { slug: "about" } });
    if (!existingAbout) {
      const aboutText =
        legacyAbout.value ||
        "纸鱼博客是一个极简风格的博客系统，基于 Next.js 与 MySQL 构建，支持 Markdown 写作、全文搜索与评论审核。\n\n在这里记录技术、设计与生活的点滴。";
      await prisma.page.create({
        data: {
          title: "关于",
          slug: "about",
          content: aboutText,
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });
    }
    await prisma.setting.deleteMany({ where: { key: "about_content" } });
  }

  // ---- 默认导航菜单 ----
  const navDefaults = [
    { label: "首页", url: "/" },
    { label: "归档", url: "/archives" },
    { label: "关于", url: "/pages/about" },
  ];
  for (let i = 0; i < navDefaults.length; i++) {
    const n = navDefaults[i];
    const exists = await prisma.navItem.findFirst({ where: { label: n.label } });
    if (!exists) {
      await prisma.navItem.create({ data: { label: n.label, url: n.url, sortOrder: i + 1 } });
    }
  }
  // 迁移：旧导航中的 /about 链接指向自定义页面
  const oldAboutNav = await prisma.navItem.findMany({ where: { url: "/about" } });
  if (oldAboutNav.length) {
    await prisma.navItem.updateMany({
      where: { url: "/about" },
      data: { url: "/pages/about" },
    });
  }

  // ---- 默认侧边栏组件 ----
  const widgetDefaults = [
    { type: "categories", sortOrder: 1 },
    { type: "recent_posts", sortOrder: 2 },
    { type: "tags", sortOrder: 3 },
  ];
  for (const w of widgetDefaults) {
    const exists = await prisma.widget.findFirst({ where: { type: w.type } });
    if (!exists) {
      await prisma.widget.create({ data: { type: w.type, sortOrder: w.sortOrder } });
    }
  }

  console.log("✅ Seed 完成");
  console.log("  管理员: admin / Admin@12345");
  console.log("  编辑:   editor / Editor@12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
