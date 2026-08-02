import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { POST_STATUS } from "@/lib/constants";

// 定时发布：把已到发布时间的 SCHEDULED 文章转为 PUBLISHED
// 查询层兜底：前台只显示 PUBLISHED 且 publishedAt <= NOW()，即使此任务未跑也不会提前泄露
export async function publishScheduledPosts() {
  const due = await prisma.post.findMany({
    where: {
      status: POST_STATUS.SCHEDULED,
      publishedAt: { lte: new Date() },
      deletedAt: null,
    },
    select: { id: true },
  });
  if (due.length === 0) return;
  await prisma.post.updateMany({
    where: { id: { in: due.map((d) => d.id) } },
    data: { status: POST_STATUS.PUBLISHED },
  });
  console.log(`[定时发布] ${due.length} 篇文章已发布`);
  revalidatePath("/");
  revalidatePath("/admin/posts");
}
