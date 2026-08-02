import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { ROLE, canAdmin } from "@/lib/constants";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-change-me"
);
const COOKIE_NAME = "session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 天

export interface SessionUser {
  id: string;
  username: string;
  role: string;
}

// 登录成功后签发 JWT 并写入 httpOnly cookie
export async function createSession(user: {
  id: bigint;
  username: string;
  role: string;
}) {
  const token = await new SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// 从 cookie 解出会话（服务端组件 / API 用；middleware 用独立的 verifySessionToken）
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      username: String(payload.username ?? ""),
      role: String(payload.role ?? ROLE.USER),
    };
  } catch {
    return null;
  }
}

// 后台页面守卫：未登录跳转登录页
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

// 后台管理守卫：必须 ADMIN
export async function requireAdmin() {
  const session = await requireSession();
  if (!canAdmin(session.role)) redirect("/admin");
  return session;
}

// API 守卫：校验数据库中的真实角色（防 JWT 被篡改）
export async function requireApiUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: BigInt(session.id) },
    select: { id: true, username: true, role: true },
  });
  return user;
}
