import { getSettings } from "@/lib/settings";
import { ResetForm } from "./reset-form";

export const metadata = { title: "重置密码" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const settings = await getSettings();
  const siteName = settings.site_name || "纸鱼博客";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{siteName}</h1>
          <p className="mt-1.5 text-sm text-muted">重置密码</p>
        </div>
        {token ? (
          <ResetForm token={token} />
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted">
              缺少重置令牌，请从邮件或重置链接进入本页。
            </p>
            <a href="/forgot-password" className="btn btn-outline w-full">
              重新申请
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
