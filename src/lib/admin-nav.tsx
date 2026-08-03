import {
  LayoutDashboard,
  FileText,
  FilePlus2,
  FolderOpen,
  Tags,
  Link2,
  MessageSquare,
  Bell,
  Settings,
  Users,
  DatabaseBackup,
  Menu,
  LayoutTemplate,
  ImageIcon,
  Palette,
  Puzzle,
  Store,
} from "lucide-react";

// 后台侧边栏导航（emlog 风格：父分组折叠 + 子菜单）
// 桌面端（layout.tsx）与移动端（admin-shell.tsx）共用同一份数据，保证一致
export interface AdminNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  exact?: boolean;
  require?: "edit" | "admin"; // edit = 可管理文章（编辑/管理员），admin = 仅管理员
  badge?: number; // 徽标数（消费处按需附加，如未读通知）
}

export interface AdminNavGroup {
  id: string;
  label: string;
  items: AdminNavItem[];
}

// 置顶项（不分组）
export const ADMIN_TOP_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "工作台", icon: LayoutDashboard, exact: true },
];

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "content",
    label: "内容",
    items: [
      { href: "/admin/posts", label: "文章管理", icon: FileText },
      { href: "/admin/pages", label: "页面管理", icon: FilePlus2, require: "edit" },
      { href: "/admin/categories", label: "分类管理", icon: FolderOpen, require: "edit" },
      { href: "/admin/tags", label: "标签管理", icon: Tags, require: "edit" },
      { href: "/admin/uploads", label: "媒体库", icon: ImageIcon, require: "edit" },
    ],
  },
  {
    id: "interaction",
    label: "互动",
    items: [
      { href: "/admin/comments", label: "评论审核", icon: MessageSquare, require: "edit" },
      { href: "/admin/notifications", label: "通知", icon: Bell, require: "edit" },
      { href: "/admin/links", label: "友情链接", icon: Link2, require: "edit" },
    ],
  },
  {
    id: "appearance",
    label: "外观",
    items: [
      { href: "/admin/nav", label: "导航菜单", icon: Menu, require: "edit" },
      { href: "/admin/widgets", label: "侧边栏组件", icon: LayoutTemplate, require: "edit" },
      { href: "/admin/appearance", label: "主题与外观", icon: Palette, require: "edit" },
    ],
  },
  {
    id: "system",
    label: "系统",
    items: [
      { href: "/admin/settings", label: "站点设置", icon: Settings, require: "edit" },
      { href: "/admin/store", label: "应用商店", icon: Store, require: "admin" },
      { href: "/admin/plugins", label: "插件管理", icon: Puzzle, require: "admin" },
      { href: "/admin/users", label: "用户管理", icon: Users, require: "admin" },
      { href: "/admin/backup", label: "数据备份", icon: DatabaseBackup, require: "admin" },
    ],
  },
];
