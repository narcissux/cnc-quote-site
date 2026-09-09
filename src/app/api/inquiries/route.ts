import { NextRequest, NextResponse } from "next/server";
import { computeQuote } from "@/lib/quote/engine";
import { loadQuoteConfig } from "@/lib/quote/runtime-config";
import { createInquiry } from "@/lib/inquiry/store";
import type {
  FinishId,
  GeometryMetrics,
  LeadTierId,
  MachineId,
  MaterialId,
  PricingMode,
  ToleranceId,
} from "@/lib/quote/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

function parseJsonField<T>(form: FormData, key: string): T | null {
  const raw = form.get(key);
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const geometry = parseJsonField<GeometryMetrics>(form, "geometry");
    if (!geometry) {
      return NextResponse.json({ error: "缺少 geometry" }, { status: 400 });
    }

    const materialId = String(form.get("materialId") || "") as MaterialId;
    const quantity = Number(form.get("quantity") || 1);
    const tolerance = String(form.get("tolerance") || "standard") as ToleranceId;
    const finish = String(form.get("finish") || "as_machined") as FinishId;
    const machine = String(form.get("machine") || "3axis") as MachineId;
    const mode = String(form.get("mode") || "hourly") as PricingMode;
    const leadTier = String(form.get("leadTier") || "standard") as LeadTierId;
    const fileName = String(form.get("fileName") || "") || undefined;

    const contact = {
      name: String(form.get("contactName") || "") || undefined,
      phone: String(form.get("contactPhone") || "") || undefined,
      email: String(form.get("contactEmail") || "") || undefined,
      company: String(form.get("contactCompany") || "") || undefined,
      note: String(form.get("contactNote") || "") || undefined,
    };

    const cfg = await loadQuoteConfig();
    if (!cfg.materials[materialId]) {
      return NextResponse.json({ error: "无效材料" }, { status: 400 });
    }

    const autoQuote = computeQuote(
      {
        geometry,
        materialId,
        quantity,
        tolerance,
        finish,
        machine,
        mode,
        leadTier,
      },
      cfg,
    );

    const files: Array<{
      field: string;
      filename: string;
      buffer: Buffer;
      contentType: string;
    }> = [];

    for (const field of ["model", "stl", "step", "pdf", "drawing"] as const) {
      const entries = form.getAll(field);
      for (const entry of entries) {
        if (!(entry instanceof File) || entry.size === 0) continue;
        if (entry.size > MAX_BYTES) {
          return NextResponse.json(
            { error: `${field} 文件不能超过 25MB` },
            { status: 400 },
          );
        }
        const buf = Buffer.from(await entry.arrayBuffer());
        files.push({
          field,
          filename: entry.name || field,
          buffer: buf,
          contentType: entry.type || "application/octet-stream",
        });
      }
    }

    const record = await createInquiry({
      materialId,
      quantity: Math.min(1000, Math.max(1, Math.floor(quantity))),
      tolerance,
      finish,
      machine,
      mode,
      leadTier,
      geometry,
      autoQuote,
      contact,
      fileName,
      files,
    });

    return NextResponse.json({ inquiryId: record.id, autoQuote });
  } catch (e) {
    console.error("[inquiries]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "提交失败" },
      { status: 500 },
    );
  }
}
