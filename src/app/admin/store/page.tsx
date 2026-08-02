import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canAdmin } from "@/lib/constants";
import {
  compareVersions,
  fetchCatalog,
  getInstalledVersion,
  OFFICIAL_STORE_URL,
  type StoreItem,
} from "@/lib/store";
import { StoreView } from "./store-view";

export const metadata = { title: "应用商店" };

export const dynamic = "force-dynamic";

export interface StoreEntry extends StoreItem {
  installed: boolean;
  localVersion: string | null;
  updateAvailable: boolean;
}

export default async function StorePage() {
  const session = await requireSession();
  if (!session) redirect("/login");
  const canEdit = canAdmin(session.role);

  const [themeCat, pluginCat] = await Promise.all([
    fetchCatalog("theme"),
    fetchCatalog("plugin"),
  ]);

  function annotate(
    cat: Awaited<ReturnType<typeof fetchCatalog>>,
    kind: "theme" | "plugin"
  ): StoreEntry[] {
    return cat.items.map((it) => {
      const local = getInstalledVersion(kind, it.name);
      return {
        ...it,
        installed: local !== null,
        localVersion: local,
        updateAvailable: local !== null && compareVersions(local, it.version) < 0,
      };
    });
  }

  const themeItems = annotate(themeCat, "theme");
  const pluginItems = annotate(pluginCat, "plugin");
  const base = themeCat.base || pluginCat.base || "";
  const themeError = themeCat.error;
  const pluginError = pluginCat.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">应用商店</h1>
        <p className="mt-1 text-sm text-muted">
          从商店一键安装主题与插件，已安装且有新版本时会提示更新。
          {base ? (
            <>
              当前商店源：
              <code className="rounded bg-muted/40 px-1.5 py-0.5">
                {base === OFFICIAL_STORE_URL ? "内置官方商店（GitHub Pages）" : base}
              </code>
            </>
          ) : (
            <span>当前使用内置商店（public/store）。</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          应用商店地址留空时默认使用内置官方商店，远程不可达会自动回退内置商店；
          也可在“站点设置 → 应用商店地址”配置自定义远程源。商店包与手动安装共用同一套安全校验。
        </p>
      </div>

      <StoreView
        themeItems={themeItems}
        pluginItems={pluginItems}
        themeError={themeError}
        pluginError={pluginError}
        base={base}
        canEdit={canEdit}
      />
    </div>
  );
}
