import { NextRequest, NextResponse } from "next/server";
import {
  isAdminConfigured,
  setAdminSessionCookie,
  verifyAdminCredential,
} from "@/lib/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "未配置 ADMIN_PASSWORD 或 ADMIN_TOKEN 环境变量" },
      { status: 503 },
    );
  }
  let credential = "";
  try {
    const body = (await req.json()) as { password?: string; token?: string };
    credential = (body.password || body.token || "").trim();
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }
  if (!verifyAdminCredential(credential)) {
    return NextResponse.json({ error: "密码或令牌错误" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  setAdminSessionCookie(res);
  return res;
}
