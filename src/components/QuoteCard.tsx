"use client";

import type { QuoteResult } from "@/lib/quote/types";

function yuan(n: number): string {
  return `¥${n.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const LEAD_TIER_ZH: Record<string, string> = {
  rush: "加急",
  standard: "标准",
  economy: "经济",
};

export function QuoteCard({ quote }: { quote: QuoteResult }) {
  const band = 100 - quote.confidencePct;
  const lineSum = quote.lines.reduce((s, l) => s + l.amountCny, 0);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">
            {quote.mode === "hourly" ? "工时报价" : "按件报价"} · 人民币 ·{" "}
            {LEAD_TIER_ZH[quote.leadTier] || quote.leadTier}交期
          </div>
          <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            {yuan(quote.totalPriceCny)}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            单价 {yuan(quote.unitPriceCny)} · 交期约 {quote.leadTimeDays} 天
          </div>
        </div>
        <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          置信 ±{band}%
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        估算切削时间 {quote.cutTimeMin.toFixed(1)} 分钟 · 机床工时{" "}
        {quote.machineHours.toFixed(2)} 小时（近似，非 CAM 循环时间）
      </div>

      <ul className="mt-4 divide-y divide-slate-100">
        {quote.lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-3 py-2.5">
            <div>
              <div className="text-sm font-medium text-slate-800">{line.label}</div>
              <div className="text-xs text-slate-500">{line.formula}</div>
            </div>
            <div className="shrink-0 text-sm font-semibold text-slate-900">
              {yuan(line.amountCny)}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold">
        <span>合计（五项加总）</span>
        <span>{yuan(lineSum)}</span>
      </div>

      <div className="mt-4 space-y-1 border-t border-slate-100 pt-3">
        {quote.notes.map((n, i) => (
          <p key={i} className="text-xs leading-relaxed text-slate-500">
            {n}
          </p>
        ))}
      </div>
    </div>
  );
}
