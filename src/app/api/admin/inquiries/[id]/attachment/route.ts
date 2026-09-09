import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { requireAdmin } from "@/lib/admin/auth";
import { attachmentAbsolutePath, getInquiry } from "@/lib/inquiry/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const filename = req.nextUrl.searchParams.get("file") || "";
  const record = await getInquiry(id);
  if (!record) {
    return NextResponse.json({ error: "询价不存在" }, { status: 404 });
  }
  const att = record.attachments.find((a) => a.filename === filename);
  if (!att) {
    return NextResponse.json({ error: "附件不存在" }, { status: 404 });
  }
  const abs = attachmentAbsolutePath(id, filename);
  if (!abs) {
    return NextResponse.json({ error: "非法文件名" }, { status: 400 });
  }
  try {
    const buf = await fs.readFile(abs);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": att.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(att.filename)}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "读取失败" }, { status: 404 });
  }
}
