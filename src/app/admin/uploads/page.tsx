import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { buildTypeWhere, MEDIA_TYPES, type MediaType } from "@/lib/media-filter";
import { UploadsManager } from "@/components/admin/uploads-manager";

export const metadata = { title: "媒体库" };

const PAGE_SIZE = 48;

export default async function UploadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSession();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim();
  const rawType = sp.type ?? "";
  const type = (MEDIA_TYPES as readonly string[]).includes(rawType)
    ? (rawType as MediaType)
    : undefined;

  const where: Record<string, unknown> = {};
  if (q) where.originalName = { contains: q };
  Object.assign(where, buildTypeWhere(type));

  const [total, uploads] = await Promise.all([
    prisma.upload.count({ where }),
    prisma.upload.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        originalName: true,
        url: true,
        mime: true,
        size: true,
        width: true,
        height: true,
        createdAt: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">媒体库</h1>
        <p className="mt-1 text-sm text-muted">
          共 {total} 个媒体，支持本地上传与外部链接（图片自动压缩，大小限制可在站点设置调整）
        </p>
      </div>

      <UploadsManager
        uploads={uploads.map((u) => ({
          id: String(u.id),
          originalName: u.originalName,
          url: u.url,
          mime: u.mime,
          size: u.size,
          width: u.width,
          height: u.height,
          createdAt: formatDateTime(u.createdAt),
        }))}
        total={total}
        page={page}
        totalPages={totalPages}
        q={q}
        type={type}
      />
    </div>
  );
}
