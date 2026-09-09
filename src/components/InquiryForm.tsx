"use client";

import { useState } from "react";
import type { QuoteFormState } from "./QuoteForm";
import type { GeometryMetrics, QuoteResult } from "@/lib/quote/types";

export function InquiryForm({
  form,
  metrics,
  fileName,
  modelFile,
  quote,
}: {
  form: QuoteFormState;
  metrics: GeometryMetrics;
  fileName: string | null;
  modelFile: File | null;
  quote: QuoteResult;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [note, setNote] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("geometry", JSON.stringify(metrics));
      body.append("materialId", form.materialId);
      body.append("quantity", String(form.quantity));
      body.append("tolerance", form.tolerance);
      body.append("finish", form.finish);
      body.append("machine", form.machine);
      body.append("mode", form.mode);
      body.append("leadTier", form.leadTier);
      if (fileName) body.append("fileName", fileName);
      body.append("contactName", name);
      body.append("contactPhone", phone);
      body.append("contactEmail", email);
      body.append("contactCompany", company);
      body.append("contactNote", note);
      if (modelFile) {
        const lower = modelFile.name.toLowerCase();
        const field =
          lower.endsWith(".stl") ? "stl" : lower.endsWith(".step") || lower.endsWith(".stp") ? "step" : "model";
        body.append(field, modelFile, modelFile.name);
      }
      if (pdf) body.append("pdf", pdf, pdf.name);

      const res = await fetch("/api/inquiries", { method: "POST", body });
      const data = (await res.json()) as { inquiryId?: string; error?: string };
      if (!res.ok) {
        setError(data.error || "提交失败");
        return;
      }
      setResult(`询价已提交，编号 ${data.inquiryId}`);
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">提交询价</h2>
      <p className="mt-1 text-sm text-slate-500">
        将保存几何摘要、当前报价快照（¥{quote.totalPriceCny.toFixed(2)}）与附件，可选填联系方式
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          姓名
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="text-sm">
          电话
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="text-sm">
          邮箱
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="text-sm">
          公司
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </label>
        <label className="sm:col-span-2 text-sm">
          备注
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <label className="sm:col-span-2 text-sm">
          附加 PDF 图纸（可选）
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="mt-1 block w-full text-sm"
            onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
          />
        </label>
        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        {result && <p className="sm:col-span-2 text-sm text-emerald-700">{result}</p>}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "提交中…" : "提交询价单"}
          </button>
        </div>
      </form>
    </div>
  );
}
