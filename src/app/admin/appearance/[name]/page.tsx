import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import {
  THEMES_DIR,
  THEME_NAME_RE,
  getActiveTheme,
  getThemeSchema,
  getThemeValues,
  readThemeManifest,
} from "@/lib/theme";
import { SchemaForm } from "@/components/admin/schema-form";
import { SettingsImportExport } from "@/components/admin/settings-import-export";
import { saveThemeSettings } from "../actions";

export const metadata = { title: "主题设置" };

export const dynamic = "force-dynamic";

// 主题设置独立页（对标插件 /admin/plugins/[name]）：仅当前激活主题可配置
// （主题间共享 theme:{key} 设置命名空间，编辑非激活主题的设置会互相覆盖，故仅 active 开放）
export default async function ThemeSettingsPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const session = await requireSession();
  if (!session) redirect("/login");
  const canEdit = canManagePosts(session.role);

  if (!THEME_NAME_RE.test(name)) notFound();
  if (!fs.existsSync(path.join(THEMES_DIR, name))) notFound();
  const { manifest, error } = readThemeManifest(name);
  if (!manifest) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">主题设置</h1>
        <div className="card p-8 text-sm text-danger">
          主题“{name}”不可用：{error ?? "manifest 无效"}
        </div>
      </div>
    );
  }

  const active = await getActiveTheme();
  const isActive = name === active;
  const schema = getThemeSchema(name);
  const values = await getThemeValues();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/appearance" className="text-xs text-muted hover:text-accent">
          ← 返回主题列表
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{manifest.title}</h1>
          <span className="text-xs text-muted">v{manifest.version}</span>
          {isActive && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
              当前主题
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">{manifest.description ?? "主题设置"}</p>
      </div>

      {!isActive ? (
        <div className="card p-8 text-sm text-muted">
          该主题当前未启用，可先
          <Link href="/admin/appearance" className="mx-1 text-accent underline">
            回到主题列表启用
          </Link>
          后再配置。
        </div>
      ) : schema.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          该主题没有可配置的设置项。
        </div>
      ) : (
        <>
          <SchemaForm
            fields={schema}
            initial={values}
            onSubmit={saveThemeSettings}
            canEdit={canEdit}
            hint="所有主题设置保存后立即对前台生效。"
          />
          <SettingsImportExport theme={name} values={values} canEdit={canEdit} />
        </>
      )}
    </div>
  );
}
