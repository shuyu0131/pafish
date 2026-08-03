import { NextResponse } from "next/server";
import {
  PLUGIN_NAME_RE,
  PLUGIN_PAGE_PATH_RE,
  createPluginContext,
  getActivePlugins,
  loadPluginModule,
  readManifest,
} from "@/lib/plugin-loader";
import { renderPublicShell } from "@/lib/public-shell";

// ---------- 插件前台页面（对标 emlog <alias>_show.php：/?plugin=name） ----------
// 路由：/plugin/<name>/<path>，path 缺省视为 "index"。
// node runtime 动态加载插件模块并调用 renderPluginPage(path, ctx) 渲染 HTML，
// 再拼公共 shell（导航/主题/注入）返回完整页面。

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string; path?: string[] }> }
) {
  const { name, path } = await params;
  if (!PLUGIN_NAME_RE.test(name)) return new NextResponse("Not Found", { status: 404 });

  // 路径白名单校验（每段独立校验，防穿越）；缺省 = index
  const segs = (path ?? []).filter(Boolean);
  if (segs.length > 1 || segs.some((s) => !PLUGIN_PAGE_PATH_RE.test(s))) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const pagePath = segs[0] ?? "index";

  // 插件必须处于启用状态且声明了该页面
  const active = await getActivePlugins();
  if (!active.includes(name)) return new NextResponse("Not Found", { status: 404 });
  const { manifest } = readManifest(name);
  const pageDecl = manifest?.pages?.find((p) => p.path === pagePath);
  if (!pageDecl) return new NextResponse("Not Found", { status: 404 });

  // 渲染：插件模块需导出 renderPluginPage(path, ctx) -> string | null
  const mod = await loadPluginModule(name);
  const fn = mod?.renderPluginPage;
  if (typeof fn !== "function") return new NextResponse("Not Found", { status: 404 });
  let html: unknown;
  try {
    html = await (fn as (path: string, ctx: unknown) => unknown)(pagePath, createPluginContext(name));
  } catch (err) {
    console.error(`[plugins] ${name} renderPluginPage(${pagePath}) 失败：`, err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
  if (typeof html !== "string" || !html.trim()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const page = await renderPublicShell(html.trim(), pageDecl.title);
  return new NextResponse(page, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
