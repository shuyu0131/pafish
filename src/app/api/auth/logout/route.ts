import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/auth";
import { doAction } from "@/lib/hooks";

export async function POST() {
  const session = await getSession();
  if (session) {
    // 钩子：退出登录
    await doAction("after_logout", { id: String(session.id) });
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
