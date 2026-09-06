"use client";

import type { GeometryMetrics } from "@/lib/quote/types";

function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function GeometryPanel({ metrics }: { metrics: GeometryMetrics }) {
  const items = [
    { label: "长 × 宽 × 高", value: `${fmt(metrics.lengthMm)} × ${fmt(metrics.widthMm)} × ${fmt(metrics.heightMm)} mm` },
    { label: "体积", value: `${fmt(metrics.volumeMm3)} mm³` },
    { label: "表面积", value: `${fmt(metrics.surfaceAreaMm2)} mm²` },
    { label: "三角面数", value: fmt(metrics.triangleCount, 0) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((it) => (
        <div key={it.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="text-xs text-slate-500">{it.label}</div>
          <div className="mt-0.5 text-sm font-medium text-slate-900">{it.value}</div>
        </div>
      ))}
    </div>
  );
}
