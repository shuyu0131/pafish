import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";

// 开放 API 鉴权：api_enabled 关闭或 Key 不匹配时返回 401
// 直接查库读 settings（getSettings 的 React cache 在 route handler 间可能跨请求缓存旧值）
export async function requireApiKey(req: NextRequest): Promise<NextResponse | null> {
  const [enabledRow, keyRow] = await Promise.all([
    prisma.setting.findFirst({ where: { key: "api_enabled" } }),
    prisma.setting.findFirst({ where: { key: "api_key" } }),
  ]);
  if (enabledRow?.value !== "true" || !keyRow?.value) {
    return NextResponse.json(
      { error: "开放 API 未启用，请在后台站点设置中开启" },
      { status: 401 }
    );
  }

  const provided = req.headers.get("x-api-key") ?? "";
  const expected = keyRow.value;
  // 长度不同直接拒绝（timingSafeEqual 要求等长 Buffer）
  if (provided.length !== expected.length) {
    return NextResponse.json({ error: "无效的 API Key" }, { status: 401 });
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "无效的 API Key" }, { status: 401 });
  }
  return null;
}

// 生成新的 API Key（32 位随机十六进制）
export function generateApiKey(): string {
  return Array.from({ length: 32 }, () =>
    "0123456789abcdef"[Math.floor(Math.random() * 16)]
  ).join("");
}
