import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getInquiry, updateInquiry } from "@/lib/inquiry/store";
import type { InquiryStatus } from "@/lib/inquiry/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const record = await getInquiry(id);
  if (!record) {
    return NextResponse.json({ error: "询价不存在" }, { status: 404 });
  }
  return NextResponse.json(record);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as {
      status?: InquiryStatus;
      manualPriceCny?: number | null;
    };
    const patch: {
      status?: InquiryStatus;
      manualPriceCny?: number | null;
    } = {};
    if (body.status === "pending" || body.status === "quoted" || body.status === "closed") {
      patch.status = body.status;
    }
    if (body.manualPriceCny === null) {
      patch.manualPriceCny = null;
    } else if (typeof body.manualPriceCny === "number" && Number.isFinite(body.manualPriceCny)) {
      patch.manualPriceCny = Math.round(body.manualPriceCny * 100) / 100;
    }
    const updated = await updateInquiry(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "询价不存在" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "更新失败" },
      { status: 400 },
    );
  }
}
