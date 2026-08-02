import { NextResponse } from "next/server";
import { createCaptcha } from "@/lib/captcha";

// 图形验证码：返回 token（校验用）+ SVG（直接渲染，currentColor 自适应亮暗主题）
export async function GET() {
  const { token, svg } = createCaptcha();
  return NextResponse.json({ token, svg });
}
