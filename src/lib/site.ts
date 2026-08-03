// 站点绝对 URL：生产环境通过 SITE_URL 环境变量配置，开发默认 localhost
export function siteUrl(path = ""): string {
  const base = (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
  return base + path;
}
