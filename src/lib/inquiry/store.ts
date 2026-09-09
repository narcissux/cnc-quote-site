import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getDataDir } from "@/lib/quote/runtime-config";
import type {
  GeometryMetrics,
  LeadTierId,
  MaterialId,
  QuoteResult,
  ToleranceId,
  FinishId,
  MachineId,
  PricingMode,
} from "@/lib/quote/types";

export type InquiryStatus = "pending" | "quoted" | "closed";

export interface InquiryContact {
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  note?: string;
}

export interface InquiryRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: InquiryStatus;
  materialId: MaterialId;
  quantity: number;
  tolerance: ToleranceId;
  finish: FinishId;
  machine: MachineId;
  mode: PricingMode;
  leadTier: LeadTierId;
  geometry: GeometryMetrics;
  autoQuote: QuoteResult;
  manualPriceCny: number | null;
  contact: InquiryContact;
  attachments: Array<{
    field: string;
    filename: string;
    size: number;
    contentType: string;
  }>;
  fileName?: string;
}

function inquiriesRoot(): string {
  return path.join(getDataDir(), "inquiries");
}

function inquiryDir(id: string): string {
  return path.join(inquiriesRoot(), id);
}

function metaPath(id: string): string {
  return path.join(inquiryDir(id), "meta.json");
}

export async function listInquiries(): Promise<InquiryRecord[]> {
  const root = inquiriesRoot();
  try {
    const names = await fs.readdir(root);
    const records: InquiryRecord[] = [];
    for (const name of names) {
      try {
        const text = await fs.readFile(metaPath(name), "utf8");
        records.push(JSON.parse(text) as InquiryRecord);
      } catch {
        // skip broken dirs
      }
    }
    records.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return records;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") return [];
    throw e;
  }
}

export async function getInquiry(id: string): Promise<InquiryRecord | null> {
  try {
    const text = await fs.readFile(metaPath(id), "utf8");
    return JSON.parse(text) as InquiryRecord;
  } catch {
    return null;
  }
}

export async function createInquiry(input: {
  materialId: MaterialId;
  quantity: number;
  tolerance: ToleranceId;
  finish: FinishId;
  machine: MachineId;
  mode: PricingMode;
  leadTier: LeadTierId;
  geometry: GeometryMetrics;
  autoQuote: QuoteResult;
  contact?: InquiryContact;
  fileName?: string;
  files: Array<{
    field: string;
    filename: string;
    buffer: Buffer;
    contentType: string;
  }>;
}): Promise<InquiryRecord> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const dir = inquiryDir(id);
  await fs.mkdir(dir, { recursive: true });

  const attachments: InquiryRecord["attachments"] = [];
  for (const f of input.files) {
    const safe = f.filename.replace(/[/\\]/g, "_").slice(0, 180) || "file";
    const destName = `${f.field}-${safe}`;
    await fs.writeFile(path.join(dir, destName), f.buffer);
    attachments.push({
      field: f.field,
      filename: destName,
      size: f.buffer.length,
      contentType: f.contentType || "application/octet-stream",
    });
  }

  const record: InquiryRecord = {
    id,
    createdAt: now,
    updatedAt: now,
    status: "pending",
    materialId: input.materialId,
    quantity: input.quantity,
    tolerance: input.tolerance,
    finish: input.finish,
    machine: input.machine,
    mode: input.mode,
    leadTier: input.leadTier,
    geometry: input.geometry,
    autoQuote: input.autoQuote,
    manualPriceCny: null,
    contact: input.contact ?? {},
    attachments,
    fileName: input.fileName,
  };

  await fs.writeFile(metaPath(id), JSON.stringify(record, null, 2), "utf8");
  return record;
}

export async function updateInquiry(
  id: string,
  patch: {
    status?: InquiryStatus;
    manualPriceCny?: number | null;
  },
): Promise<InquiryRecord | null> {
  const existing = await getInquiry(id);
  if (!existing) return null;
  if (patch.status !== undefined) existing.status = patch.status;
  if (patch.manualPriceCny !== undefined) {
    existing.manualPriceCny = patch.manualPriceCny;
  }
  existing.updatedAt = new Date().toISOString();
  await fs.writeFile(metaPath(id), JSON.stringify(existing, null, 2), "utf8");
  return existing;
}

export function attachmentAbsolutePath(
  id: string,
  filename: string,
): string | null {
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return null;
  }
  return path.join(inquiryDir(id), filename);
}
