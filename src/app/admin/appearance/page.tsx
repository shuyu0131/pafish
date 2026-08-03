import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import {
  getActiveTheme,
  getThemeSchema,
  listThemes,
  readThemeManifest,
} from "@/lib/theme";
import { ThemeList } from "./theme-list";
import { ThemeInstall } from "./theme-install";

export const metadata = { title: "主题与外观" };

export const dynamic = "force-dynamic";

export default async function AppearancePage() {
  const session = await requireSession();
  if (!session) redirect("/login");
  const canEdit = canManagePosts(session.role);

  const active = await getActiveTheme();
  const themes = listThemes().map((name) => {
    const { manifest, error } = readThemeManifest(name);
    return {
      name,
      manifest,
      error,
      current: name === active,
      settingsCount: getThemeSchema(name).length,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">主题与外观</h1>
        <p className="mt-1 text-sm text-muted">
          主题存放在 <code className="rounded bg-muted/40 px-1.5 py-0.5">themes/</code>{" "}
          目录，每个主题由 theme.json 声明设置项，可选 theme.css 覆盖配色。切换后即时生效，
          点击当前主题的“设置”进入独立设置页。
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">已安装主题</h2>
        <ThemeList themes={themes} canEdit={canEdit} />
      </section>

      <ThemeInstall canEdit={canEdit} />
    </div>
  );
}
