import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import { getPageTemplateOptions } from "@/lib/page-templates";
import { PageEditor } from "@/components/admin/page-editor";

export const metadata = { title: "编辑页面" };

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const canEdit = canManagePosts(session.role);
  const { id } = await params;
  const page = await prisma.page.findUnique({ where: { id: BigInt(id) } });
  if (!page) notFound();
  const templateOptions = await getPageTemplateOptions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">编辑页面</h1>
        <p className="mt-1 text-sm text-muted">
          {canEdit ? "修改后记得保存" : "只读模式"}
        </p>
      </div>
      {canEdit ? (
        <PageEditor
          mode="edit"
          pageId={String(page.id)}
          templateOptions={templateOptions}
          initial={{
            title: page.title,
            slug: page.slug,
            content: page.content,
            status: page.status,
            template: page.template,
          }}
        />
      ) : (
        <p className="text-sm text-muted">无编辑权限</p>
      )}
    </div>
  );
}
