// 图形验证码：SVG 生成（零依赖）+ 内存校验
// 答案只存进程内存（与评论限频同模式，单实例足够；重启即失效属预期）
import { randomBytes } from "node:crypto";

// 字符集避开 0/O/1/I/L 等易混字符
const CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LEN = 4;
// 验证码有效期（毫秒）
const CAPTCHA_TTL_MS = 5 * 60 * 1000;

interface CaptchaEntry {
  answer: string;
  expiresAt: number;
}

const captchaStore = new Map<string, CaptchaEntry>();

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

// 生成一个验证码，返回 token（用于取答案）与 SVG 字符串
export function createCaptcha(): { token: string; svg: string } {
  const token = randomToken();
  const chars: string[] = [];
  for (let i = 0; i < CODE_LEN; i++) {
    chars.push(CHARS[randomInt(CHARS.length)]);
  }
  const answer = chars.join("");
  const svg = renderSvg(chars);
  captchaStore.set(token, { answer, expiresAt: Date.now() + CAPTCHA_TTL_MS });
  return { token, svg };
}

// 校验验证码：正确则立即销毁（用后即焚），错误保留（可重试）
export function verifyCaptcha(token: string, answer: string): boolean {
  if (!token || !answer) return false;
  const entry = captchaStore.get(token);
  if (!entry || entry.expiresAt < Date.now()) return false;
  if (entry.answer.toUpperCase() === answer.toUpperCase().trim()) {
    captchaStore.delete(token);
    return true;
  }
  return false;
}

function randomToken(): string {
  return randomBytes(16).toString("hex");
}

// 渲染 4 位验证码 SVG：随机旋转 + 干扰线，currentColor 适配亮暗主题
function renderSvg(chars: string[]): string {
  const width = 120;
  const height = 40;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="验证码">`
  );

  // 干扰线（3 条，随角度位置）
  for (let i = 0; i < 3; i++) {
    const x1 = randomInt(width);
    const y1 = randomInt(height);
    const x2 = randomInt(width);
    const y2 = randomInt(height);
    parts.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-opacity="0.35" stroke-width="1"/>`
    );
  }

  // 字符（逐个旋转）
  chars.forEach((c, i) => {
    const x = 18 + i * 26;
    const y = 27 + randomInt(6) - 3;
    const rot = randomInt(36) - 18;
    parts.push(
      `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})" font-family="monospace" font-size="24" font-weight="bold" fill="currentColor" text-anchor="middle">${c}</text>`
    );
  });

  parts.push(`</svg>`);
  return parts.join("");
}
