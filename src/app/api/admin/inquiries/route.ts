import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { listInquiries } from "@/lib/inquiry/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const list = await listInquiries();
  const summary = list.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    status: r.status,
    materialId: r.materialId,
    quantity: r.quantity,
    leadTier: r.leadTier,
    autoTotalCny: r.autoQuote.totalPriceCny,
    manualPriceCny: r.manualPriceCny,
    fileName: r.fileName,
    contactName: r.contact?.name,
  }));
  return NextResponse.json({ inquiries: summary });
}
