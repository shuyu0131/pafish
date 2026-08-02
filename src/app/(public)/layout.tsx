import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { getSession } from "@/lib/auth";
import { getVisibleNavItems } from "@/lib/widgets";
import { getThemeValues, getActiveTheme, getThemeCss } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteSearch } from "@/components/site-search";
import { MobileNav } from "@/components/mobile-nav";
import { PublicNav } from "@/components/public-nav";
import { SidebarWidgets } from "@/components/sidebar-widgets";
import { HtmlInjection } from "@/components/injection-target";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();
  const siteName = settings.site_name || "纸鱼博客";
  const subtitle = settings.site_subtitle || "";
  const session = await getSession();
  const theme = await getThemeValues();
  const showSidebar = theme.sidebar_enabled !== "0";
  const navItems = (await getVisibleNavItems()).map((n) => ({
    id: String(n.id),
    label: n.label,
    url: n.url,
    isExternal: n.isExternal,
  }));
  // 主题 CSS 变量覆盖（themes/{name}/theme.css）——只在前台注入，后台保持默认配色
  const activeTheme = await getActiveTheme();
  const themeCss = getThemeCss(activeTheme);

  return (
    <div className="min-h-screen bg-background">
      {themeCss ? <style data-theme={activeTheme}>{themeCss}</style> : null}
      {/* 侧边栏（桌面 40% 固定 / 移动端隐藏，导航在抽屉）；外观设置可整体关闭 */}
      {showSidebar && (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-2/5 flex-col items-center overflow-y-auto border-r border-border bg-card pt-48 lg:flex">
          <Link href="/" className="text-center">
            <span className="block text-[2rem] font-bold uppercase leading-none tracking-[2px] text-foreground">
              {siteName}
            </span>
            {subtitle && (
              <span className="mt-4 block text-sm text-side">{subtitle}</span>
            )}
          </Link>

          {/* 组件区：后台“侧边栏组件”配置 */}
          <SidebarWidgets />

          {/* 插件侧边栏注入 */}
          <HtmlInjection target="sidebar" />
        </aside>
      )}

      {/* 右侧内容栏（60%） */}
      <div className={showSidebar ? "min-h-screen lg:ml-[40%]" : "min-h-screen"}>
        {/* 桌面顶栏：固定 60% 宽，当前页下划线 */}
        <header className="fixed right-0 top-0 z-30 hidden h-[60px] w-3/5 items-stretch justify-between border-b border-border bg-card px-8 lg:flex">
          <PublicNav items={navItems} />
          <div className="flex items-center gap-5 text-xs">
            <SiteSearch />
            {session ? (
              <Link href="/admin" className="text-side transition-colors hover:text-accent">
                登录
              </Link>
            ) : (
              <Link href="/login" className="btn btn-primary !py-1.5">
                登录
              </Link>
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* 移动端顶栏：紧凑条 */}
        <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card px-5 lg:hidden">
          <Link href="/" className="text-sm font-bold uppercase tracking-[2px] text-foreground">
            {siteName}
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <MobileNav loggedIn={!!session} items={navItems} />
          </div>
        </header>

        <main className="pt-14 lg:pt-[60px]">{children}</main>

        <footer className="hidden border-t border-border py-6 text-center text-[10px] text-meta lg:block">
          <p>
            {theme.footer_text
              ? theme.footer_text
              : `© ${new Date().getFullYear()} ${siteName} · 用 Next.js 构建`}
          </p>
          {/* 插件页脚注入 */}
          <HtmlInjection target="footer" />
        </footer>
      </div>
    </div>
  );
}
