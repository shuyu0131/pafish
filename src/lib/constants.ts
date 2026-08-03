// 全局状态常量（与数据库 VARCHAR 值对应）

export const POST_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  SCHEDULED: "SCHEDULED",
} as const;

export const COMMENT_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  SPAM: "SPAM",
  TRASH: "TRASH",
} as const;

export const ROLE = {
  ADMIN: "ADMIN",
  EDITOR: "EDITOR",
  USER: "USER",
} as const;

export const POST_STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  SCHEDULED: "定时发布",
};

export const COMMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  SPAM: "垃圾评论",
  TRASH: "已删除",
};

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "管理员",
  EDITOR: "编辑",
  USER: "用户",
};

// 角色权限
export function canManagePosts(role: string) {
  return role === ROLE.ADMIN || role === ROLE.EDITOR;
}

export function canAdmin(role: string) {
  return role === ROLE.ADMIN;
}
