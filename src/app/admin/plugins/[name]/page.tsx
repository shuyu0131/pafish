import { redirect, notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { requireSession } from "@/lib/auth";
import { canAdmin } from "@/lib/constants";
import {
  PLUGINS_DIR,
  PLUGIN_NAME_RE,
  getPluginSettings,
  readManifest,
} from "@/lib/plugin-loader";
import { SchemaForm } from "@/components/admin/schema-form";
import { savePluginSettings } from "../actions";

export const metadata = { title: "插件设置" };

export const dynamic = "force-dynamic";

export default async function PluginSettingsPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const session = await requireSession();
  if (!session) redirect("/login");
  const canEdit = canAdmin(session.role);

  if (!PLUGIN_NAME_RE.test(name)) notFound();
  if (!fs.existsSync(path.join(PLUGINS_DIR, name))) notFound();
  const { manifest, error } = readManifest(name);
  if (!manifest) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">插件设置</h1>
        <div className="card p-8 text-sm text-danger">
          插件“{name}”不可用：{error ?? "manifest 无效"}
        </div>
      </div>
    );
  }

  const current = await getPluginSettings(name);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{manifest.title}</h1>
          <span className="text-xs text-muted">v{manifest.version}</span>
        </div>
        <p className="mt-1 text-sm text-muted">{manifest.description ?? "插件设置"}</p>
      </div>

      {manifest.settings?.length ? (
        <SchemaForm
          fields={manifest.settings}
          initial={current}
          onSubmit={savePluginSettings.bind(null, name)}
          canEdit={canEdit}
          hint="保存后自动刷新前台注入内容。"
        />
      ) : (
        <div className="card p-8 text-center text-sm text-muted">
          该插件没有可配置的设置项。
        </div>
      )}
    </div>
  );
}
