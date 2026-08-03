// 侧边栏组件类型常量（前后台共用，无服务端依赖）
export const WIDGET_TYPES = [
  "categories",
  "tags",
  "recent_posts",
  "hot_posts",
  "recent_comments",
  "custom",
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

// 各类型默认标题（后台表单显示用）
export const WIDGET_DEFAULT_TITLE: Record<WidgetType, string> = {
  categories: "分类",
  tags: "标签",
  recent_posts: "最新文章",
  hot_posts: "热门文章",
  recent_comments: "最新评论",
  custom: "自定义",
};

export const WIDGET_TYPE_LABEL: Record<WidgetType, string> = {
  categories: "分类",
  tags: "标签",
  recent_posts: "最新文章",
  hot_posts: "热门文章",
  recent_comments: "最新评论",
  custom: "自定义文本",
};
