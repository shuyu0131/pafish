import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canManagePosts } from "@/lib/constants";
import { updateSettings } from "../actions";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "站点设置" };

export default async function SettingsPage() {
  const session = await requireSession();
  const canEdit = canManagePosts(session.role);

  const settings = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  const fields = [
    { key: "site_name", label: "站点名称", placeholder: "纸鱼博客" },
    { key: "site_subtitle", label: "副标题", placeholder: "记录技术、设计与生活" },
    { key: "site_description", label: "站点描述（SEO）", placeholder: "用于搜索引擎描述" },
    { key: "site_icp", label: "ICP 备案号", placeholder: "如：京ICP备xxxxxxxx号" },
    {
      key: "store_url",
      label: "应用商店地址",
      placeholder: "留空使用内置官方商店",
      hint: "远程商店基础地址（http/https），其下需提供 themes.json 与 plugins.json；留空默认使用内置官方商店（GitHub Pages），远程不可达时自动回退本地内置商店。",
    },
    {
      key: "store_token",
      label: "商店访问令牌",
      placeholder: "公开源留空",
      password: true,
      hint: "私有源鉴权令牌：请求目录与 zip 下载时携带 Authorization: Bearer 头；仅远程源生效，留空 = 公开源。令牌只保存在服务器，不会出现在页面源码中。",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">站点设置</h1>
        <p className="mt-1 text-sm text-muted">配置博客前台显示与评论规则</p>
      </div>

      <SettingsForm
        fields={fields}
        initial={map}
        onSubmit={updateSettings}
        canEdit={canEdit}
      />
    </div>
  );
}
