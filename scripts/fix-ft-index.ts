// 幂等补建 posts 表 FULLTEXT 搜索索引（ft_posts_search）
// 背景：Prisma 会把手动建的 FULLTEXT 索引视为 drift，migrate dev 时可能 DROP；
// 新库执行 prisma migrate deploy 后也可能缺失（取决于迁移历史）。本脚本确保索引存在。
// 用法：npx tsx scripts/fix-ft-index.ts（依赖 .env 的 DATABASE_URL）
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

const INDEX_NAME = "ft_posts_search";
const TABLE = "posts";

async function main() {
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!, { useTextProtocol: true });
  const prisma = new PrismaClient({ adapter });

  const rows = await prisma.$queryRawUnsafe<Array<{ INDEX_NAME: string }>>(
    `SELECT INDEX_NAME FROM information_schema.statistics
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${TABLE}'
     GROUP BY INDEX_NAME`
  );
  const exists = rows.some((r) => r.INDEX_NAME === INDEX_NAME);

  if (exists) {
    console.log(`✓ 索引 ${INDEX_NAME} 已存在，无需操作`);
  } else {
    console.log(`→ 补建索引：ALTER TABLE ${TABLE} ADD FULLTEXT INDEX ${INDEX_NAME} (title, excerpt, content) WITH PARSER ngram`);
    await prisma.$queryRawUnsafe(
      `ALTER TABLE ${TABLE} ADD FULLTEXT INDEX ${INDEX_NAME} (title, excerpt, content) WITH PARSER ngram`
    );
    console.log(`✓ 索引 ${INDEX_NAME} 已创建`);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("✗ 补建索引失败：", err);
  process.exit(1);
});
