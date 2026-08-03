import { NextResponse } from "next/server";
import fs from "node:fs";
import { getSession } from "@/lib/auth";
import { canAdmin } from "@/lib/constants";
import { safeBackupPath, BACKUP_DIR } from "@/lib/backup";

// 下载备份文件（仅管理员）
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !canAdmin(session.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file") ?? "";
  const target = safeBackupPath(file);
  if (!target || !fs.existsSync(target)) {
    return NextResponse.json({ error: "备份文件不存在" }, { status: 404 });
  }
  const buf = fs.readFileSync(target);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/sql",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file)}"`,
      "Content-Length": String(buf.length),
    },
  });
}
