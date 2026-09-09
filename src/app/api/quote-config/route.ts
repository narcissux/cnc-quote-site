import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  loadQuoteConfig,
  saveQuoteConfig,
  toPublicQuoteConfig,
  validateQuoteConfigShape,
} from "@/lib/quote/runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public read-only quote config for frontend / computeQuote. */
export async function GET() {
  const cfg = await loadQuoteConfig();
  return NextResponse.json(toPublicQuoteConfig(cfg));
}

/** Admin: persist quote config JSON. */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const body = (await req.json()) as unknown;
    const cfg = validateQuoteConfigShape(body);
    await saveQuoteConfig(cfg);
    return NextResponse.json(toPublicQuoteConfig(cfg));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "保存失败" },
      { status: 400 },
    );
  }
}
