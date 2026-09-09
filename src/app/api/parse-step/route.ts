import { NextRequest, NextResponse } from "next/server";
import {
  isStepFilename,
  parseStepBuffer,
  StepParseError,
  STEP_EMPTY_OR_INVALID_MSG,
  STEP_UNSUPPORTED_MSG,
} from "@/lib/step";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "请选择 STEP 文件（字段名 file）" },
        { status: 400 }
      );
    }
    if (!isStepFilename(file.name)) {
      return NextResponse.json({ error: STEP_UNSUPPORTED_MSG }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json(
        { error: STEP_EMPTY_OR_INVALID_MSG },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "文件不能超过 25MB" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const parsed = await parseStepBuffer(buffer);

    const stlBase64 = Buffer.from(parsed.stlBuffer).toString("base64");

    return NextResponse.json({
      metrics: parsed.metrics,
      stlBase64,
      // Compact typed-array transfer for preview without re-parse if desired
      positionsBase64: Buffer.from(
        parsed.positions.buffer,
        parsed.positions.byteOffset,
        parsed.positions.byteLength
      ).toString("base64"),
      normalsBase64: Buffer.from(
        parsed.normals.buffer,
        parsed.normals.byteOffset,
        parsed.normals.byteLength
      ).toString("base64"),
    });
  } catch (e) {
    const message =
      e instanceof StepParseError
        ? e.message
        : e instanceof Error
          ? e.message.includes("STEP")
            ? e.message
            : STEP_EMPTY_OR_INVALID_MSG
          : STEP_EMPTY_OR_INVALID_MSG;
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
