import { getSettings } from "@/lib/settings";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "找回密码" };
// 页面依赖站点设置（getSettings 查库），动态渲染避免构建期（容器内无 DB）静态导出失败
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const settings = await getSettings();
  const siteName = settings.site_name || "纸鱼博客";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{siteName}</h1>
          <p className="mt-1.5 text-sm text-muted">找回密码</p>
        </div>
        <ForgotForm />
      </div>
      <p className="mt-6 text-xs text-muted">
        © {new Date().getFullYear()} {siteName}
      </p>
    </div>
  );
}
