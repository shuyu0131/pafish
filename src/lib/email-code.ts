// 邮箱验证码：注册 / 忘记密码共用
// - 6 位数字，10 分钟过期，校验通过后标记 used
// - 同一邮箱同一用途 60 秒内不能重复发送（内存限频，重启即失效）
// - 发送新码会覆盖旧码（旧码立即失效）
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";

export type EmailCodePurpose = "register" | "reset";

const CODE_TTL_MS = 10 * 60 * 1000;
// 同邮箱同用途两次发送的最小间隔（毫秒）
const SEND_MIN_INTERVAL_MS = 60 * 1000;

// 进程内记录每次发送时间（单实例足够；重启即重置）
const sendMap = new Map<string, number>();

function rateKey(email: string, purpose: EmailCodePurpose): string {
  return `${purpose}:${email.toLowerCase()}`;
}

// 生成 6 位数字验证码并入库（覆盖旧码），返回验证码明文
export async function createEmailCode(
  email: string,
  purpose: EmailCodePurpose
): Promise<{ code: string; tooFrequent: boolean }> {
  const key = rateKey(email, purpose);
  const now = Date.now();
  const last = sendMap.get(key) ?? 0;
  if (now - last < SEND_MIN_INTERVAL_MS) {
    return { code: "", tooFrequent: true };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.emailCode.create({
    data: {
      email,
      purpose,
      code,
      expiresAt: new Date(now + CODE_TTL_MS),
    },
  });
  sendMap.set(key, now);
  // 顺带清理 30 分钟前的记录，防止内存无限增长
  if (sendMap.size > 1000) {
    for (const [k, v] of sendMap) {
      if (now - v > 30 * 60 * 1000) sendMap.delete(k);
    }
  }
  return { code, tooFrequent: false };
}

// 校验验证码：成功则标记 used（一次性）；失败（含过期/不存在/已用）统一返回 false
export async function verifyEmailCode(
  email: string,
  purpose: EmailCodePurpose,
  code: string
): Promise<boolean> {
  if (!code || !/^\d{6}$/.test(code)) return false;
  const row = await prisma.emailCode.findFirst({
    where: {
      email,
      purpose,
      code,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  if (!row) return false;
  await prisma.emailCode.update({
    where: { id: row.id },
    data: { used: true },
  });
  return true;
}
