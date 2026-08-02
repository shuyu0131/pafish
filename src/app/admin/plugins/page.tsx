import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canAdmin } from "@/lib/constants";
import {
  getActivePlugins,
  getPluginData,
  listPluginDirs,
  readManifest,
} from "@/lib/plugin-loader";
import { PluginList } from "./plugin-list";
import { PluginInstall } from "./plugin-install";

export const metadata = { title: "插件管理" };

export const dynamic = "force-dynamic";

export default async function PluginsPage() {
  const session = await requireSession();
  if (!session) redirect("/login");
  const canEdit = canAdmin(session.role);

  const [active, dirs] = await Promise.all([getActivePlugins(), listPluginDirs()]);

  const plugins = await Promise.all(
    dirs.map(async (name) => {
      const { manifest, error } = readManifest(name);
      const data = await getPluginData(name);
      return {
        name,
        manifest,
        error,
        active: active.includes(name),
        dataJson: JSON.stringify(data, null, 2),
      };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">插件管理</h1>
        <p className="mt-1 text-sm text-muted">
          插件运行在服务器端，拥有与系统相同的权限；仅安装你信任的插件。
        </p>
      </div>

      {plugins.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          暂无插件。插件放在项目 <code className="rounded bg-muted/40 px-1.5 py-0.5">plugins/</code>{" "}
          目录（plugin.json + index.mjs），或通过下方“安装插件”上传 zip 包。
        </div>
      ) : (
        <PluginList plugins={plugins} canEdit={canEdit} />
      )}

      {canEdit && <PluginInstall />}
    </div>
  );
}
