import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { HeadInjections } from "@/components/injection-target";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    default: "纸鱼博客",
    template: "%s · 纸鱼博客",
  },
  description: "纸鱼博客 —— 一个极简风格的博客系统",
  metadataBase: new URL(siteUrl("/")),
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "纸鱼博客",
    title: "纸鱼博客",
    description: "纸鱼博客 —— 一个极简风格的博客系统",
  },
  twitter: {
    card: "summary",
  },
};

// 主题 CSS 变量覆盖注入在前台布局（(public)/layout.tsx）——主题只作用于前台，
// 后台（/admin、/login 等）始终使用默认配色，不受主题影响
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="h-full antialiased">
      <head>
        {/* 插件 head 注入（script/meta/link/style） */}
        <HeadInjections />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
