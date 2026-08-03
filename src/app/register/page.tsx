import { getSettings } from "@/lib/settings";
import { RegisterForm } from "./register-form";

export const metadata = { title: "注册" };

export default async function RegisterPage() {
  const settings = await getSettings();
  const siteName = settings.site_name || "纸鱼博客";
  const open = settings.allow_registration !== "false";
  // 注册邮箱验证码（后台可关；依赖 SMTP 配置）
  const requireVerify = settings.require_email_verify !== "false";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{siteName}</h1>
          <p className="mt-1.5 text-sm text-muted">创建账号</p>
        </div>
        {open ? (
          <RegisterForm requireVerify={requireVerify} />
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted">本站暂未开放注册，请联系管理员。</p>
            <a href="/login" className="btn btn-outline w-full">
              去登录
            </a>
          </div>
        )}
      </div>
      <p className="mt-6 text-xs text-muted">
        © {new Date().getFullYear()} {siteName}
      </p>
    </div>
  );
}
