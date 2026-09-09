import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const ADMIN_COOKIE = "cnc_admin_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getAdminSecret(): string | null {
  const token = process.env.ADMIN_TOKEN?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (token) return `token:${token}`;
  if (password) return `password:${password}`;
  return null;
}

export function isAdminConfigured(): boolean {
  return getAdminSecret() !== null;
}

export function sessionTokenForSecret(secret: string): string {
  return createHash("sha256").update(`cnc-admin-v1|${secret}`).digest("hex");
}

export function expectedSessionToken(): string | null {
  const secret = getAdminSecret();
  if (!secret) return null;
  return sessionTokenForSecret(secret);
}

export function verifyAdminCredential(credential: string): boolean {
  const token = process.env.ADMIN_TOKEN?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const c = credential.trim();
  if (!c) return false;
  if (token && safeEqualStr(c, token)) return true;
  if (password && safeEqualStr(c, password)) return true;
  return false;
}

function safeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const expected = expectedSessionToken();
  if (!expected) return false;
  const jar = await cookies();
  const got = jar.get(ADMIN_COOKIE)?.value;
  if (!got) return false;
  return safeEqualStr(got, expected);
}

export function setAdminSessionCookie(res: NextResponse): void {
  const token = expectedSessionToken();
  if (!token) return;
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    // Set ADMIN_COOKIE_SECURE=true behind HTTPS; default false so HTTP Docker/local works
    secure: process.env.ADMIN_COOKIE_SECURE === "true",
  });
}

export function clearAdminSessionCookie(res: NextResponse): void {
  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function requireAdmin(): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  if (!isAdminConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "未配置 ADMIN_PASSWORD 或 ADMIN_TOKEN" },
        { status: 503 },
      ),
    };
  }
  if (!(await isAdminAuthenticated())) {
    return {
      ok: false,
      response: NextResponse.json({ error: "未登录" }, { status: 401 }),
    };
  }
  return { ok: true };
}
