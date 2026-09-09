"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { StlUploader } from "./StlUploader";
import { GeometryPanel } from "./GeometryPanel";
import { QuoteForm, type QuoteFormState } from "./QuoteForm";
import { QuoteCard } from "./QuoteCard";
import { InquiryForm } from "./InquiryForm";
import { parseStlFile } from "@/lib/stl";
import { computeQuote } from "@/lib/quote";
import { DEFAULT_QUOTE_CONFIG } from "@/lib/quote/config";
import type { GeometryMetrics, QuoteConfig } from "@/lib/quote/types";

const defaultForm: QuoteFormState = {
  materialId: "Al6061",
  quantity: 1,
  tolerance: "standard",
  finish: "as_machined",
  machine: "3axis",
  mode: "hourly",
  leadTier: "standard",
};

const StlViewer = dynamic(
  () => import("./StlViewer").then((m) => m.StlViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-80 w-full items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-sm text-slate-400">
        加载 3D 预览…
      </div>
    ),
  }
);

function isStepName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".step") || lower.endsWith(".stp");
}

function decodeBase64Float32(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

export function QuoteApp() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [metrics, setMetrics] = useState<GeometryMetrics | null>(null);
  const [positions, setPositions] = useState<Float32Array | null>(null);
  const [normals, setNormals] = useState<Float32Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<QuoteFormState>(defaultForm);
  const [config, setConfig] = useState<QuoteConfig>(DEFAULT_QUOTE_CONFIG);
  const [configReady, setConfigReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/quote-config");
        if (!res.ok) throw new Error("config");
        const data = (await res.json()) as QuoteConfig;
        if (!cancelled) {
          setConfig(data);
          setConfigReady(true);
        }
      } catch {
        if (!cancelled) setConfigReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const quote = useMemo(() => {
    if (!metrics) return null;
    return computeQuote(
      {
        geometry: metrics,
        ...form,
      },
      config,
    );
  }, [metrics, form, config]);

  async function parseStepViaApi(file: File) {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/parse-step", { method: "POST", body });
    const data = (await res.json()) as {
      error?: string;
      metrics?: GeometryMetrics;
      positionsBase64?: string;
      normalsBase64?: string;
      stlBase64?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || "STEP 解析失败");
    }
    if (!data.metrics) {
      throw new Error("STEP 文件为空或无法解析（无有效实体）");
    }
    if (data.positionsBase64 && data.normalsBase64) {
      const pos = decodeBase64Float32(data.positionsBase64);
      const nrm = decodeBase64Float32(data.normalsBase64);
      if (pos.length === 0) {
        throw new Error("STEP 文件为空或无法解析（无有效实体）");
      }
      return { metrics: data.metrics, positions: pos, normals: nrm };
    }
    if (data.stlBase64) {
      const bin = atob(data.stlBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const { parseStlBuffer } = await import("@/lib/stl");
      const parsed = parseStlBuffer(bytes.buffer);
      return {
        metrics: data.metrics,
        positions: parsed.positions,
        normals: parsed.normals,
      };
    }
    throw new Error("STEP 解析失败");
  }

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      if (isStepName(file.name)) {
        const parsed = await parseStepViaApi(file);
        if (parsed.metrics.triangleCount === 0) {
          throw new Error("STEP 文件为空或无法解析（无有效实体）");
        }
        setFileName(file.name);
        setModelFile(file);
        setMetrics(parsed.metrics);
        setPositions(parsed.positions);
        setNormals(parsed.normals);
      } else {
        const parsed = await parseStlFile(file);
        if (parsed.metrics.triangleCount === 0) {
          throw new Error("文件为空或无法解析（无有效网格）");
        }
        setFileName(file.name);
        setModelFile(file);
        setMetrics(parsed.metrics);
        setPositions(parsed.positions);
        setNormals(parsed.normals);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败");
      setMetrics(null);
      setPositions(null);
      setNormals(null);
      setFileName(null);
      setModelFile(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium text-brand-600">CNC 即时报价 MVP</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          上传 STL / STEP，秒出加工估价
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          本地解析 STL，或服务端转换 STEP → 估算去除量与机时 → 按工时或按件给出人民币报价明细。
          支持加急/标准/经济交期。估算值为近似启发式，仅供参考。
          {!configReady && " · 正在同步服务端费率…"}
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
            <StlViewer
              positions={positions}
              normals={normals}
              className="h-80 w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
            />
          )}
          {metrics && <GeometryPanel metrics={metrics} />}
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">报价参数</h2>
            <p className="mt-1 text-sm text-slate-500">
              修改参数后报价卡片实时更新（费率来自服务端配置）
            </p>
            <div className="mt-4">
              <QuoteForm value={form} onChange={setForm} config={config} />
            </div>
          </div>
          {quote ? (
            <>
              <QuoteCard quote={quote} />
              {metrics && (
                <InquiryForm
                  form={form}
                  metrics={metrics}
                  fileName={fileName}
                  modelFile={modelFile}
                  quote={quote}
                />
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              上传 STL / STEP 后即可查看实时报价明细
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
