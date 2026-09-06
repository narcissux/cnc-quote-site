"use client";

import { useMemo, useState } from "react";
import { StlUploader } from "./StlUploader";
import { StlViewer } from "./StlViewer";
import { GeometryPanel } from "./GeometryPanel";
import { QuoteForm, type QuoteFormState } from "./QuoteForm";
import { QuoteCard } from "./QuoteCard";
import { parseStlFile } from "@/lib/stl";
import { computeQuote } from "@/lib/quote";
import type { GeometryMetrics } from "@/lib/quote/types";

const defaultForm: QuoteFormState = {
  materialId: "Al6061",
  quantity: 1,
  tolerance: "standard",
  finish: "as_machined",
  machine: "3axis",
  mode: "hourly",
};

export function QuoteApp() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<GeometryMetrics | null>(null);
  const [positions, setPositions] = useState<Float32Array | null>(null);
  const [normals, setNormals] = useState<Float32Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<QuoteFormState>(defaultForm);

  const quote = useMemo(() => {
    if (!metrics) return null;
    return computeQuote({
      geometry: metrics,
      ...form,
    });
  }, [metrics, form]);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const parsed = await parseStlFile(file);
      if (parsed.metrics.triangleCount === 0) {
        throw new Error("未能解析到三角面，请检查 STL 文件");
      }
      setFileName(file.name);
      setMetrics(parsed.metrics);
      setPositions(parsed.positions);
      setNormals(parsed.normals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败");
      setMetrics(null);
      setPositions(null);
      setNormals(null);
      setFileName(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium text-brand-600">CNC 即时报价 MVP</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          上传 STL，秒出加工估价
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          本地解析模型几何 → 估算去除量与机时 → 按工时或按件给出人民币报价明细。
          估算值为近似启发式，仅供参考。
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <StlUploader onFile={onFile} busy={busy} error={error} />
          {fileName && (
            <p className="text-sm text-slate-500">
              已加载：<span className="font-medium text-slate-800">{fileName}</span>
            </p>
          )}
          {positions && normals && (
            <StlViewer positions={positions} normals={normals} className="h-80 w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900" />
          )}
          {metrics && <GeometryPanel metrics={metrics} />}
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">报价参数</h2>
            <p className="mt-1 text-sm text-slate-500">
              修改参数后报价卡片实时更新
            </p>
            <div className="mt-4">
              <QuoteForm value={form} onChange={setForm} />
            </div>
          </div>
          {quote ? (
            <QuoteCard quote={quote} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              上传 STL 后即可查看实时报价明细
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
