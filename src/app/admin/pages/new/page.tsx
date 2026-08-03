import { requireSession } from "@/lib/auth";
import { getPageTemplateOptions } from "@/lib/page-templates";
import { PageEditor } from "@/components/admin/page-editor";

export const metadata = { title: "新建页面" };

export default async function NewPage() {
  await requireSession();
  const templateOptions = await getPageTemplateOptions();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">新建页面</h1>
        <p className="mt-1 text-sm text-muted">创建独立页面，可设为站点首页</p>
      </div>
      <PageEditor mode="create" templateOptions={templateOptions} />
    </div>
  );
}
