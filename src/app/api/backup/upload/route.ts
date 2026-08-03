import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAdmin } from "@/lib/constants";
import { saveUploadedSql } from "@/lib/backup";

export const runtime = "nodejs";

// 上传 SQL 备份文件（仅管理员；保存到备份目录，恢复仍需二次确认）
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !canAdmin(session.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".sql")) {
      return NextResponse.json({ error: "仅支持 .sql 文件" }, { status: 400 });
    }
    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json({ error: "文件超过 200MB 限制" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    // 简单校验：必须是 mysqldump 产出的 SQL（含 CREATE TABLE 或 INSERT）
    const head = buf.subarray(0, 4096).toString("utf8");
    if (!/CREATE TABLE|INSERT INTO|mysqldump/i.test(head)) {
      return NextResponse.json({ error: "文件内容不是有效的 SQL 备份" }, { status: 400 });
    }
    const name = await saveUploadedSql(buf);
    return NextResponse.json({ file: name });
  } catch {
    return NextResponse.json({ error: "上传失败" }, { status: 500 });
  }
}
