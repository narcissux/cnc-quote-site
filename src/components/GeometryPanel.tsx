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
  const fill =
    typeof metrics.fillRatio === "number"
      ? metrics.fillRatio
      : metrics.lengthMm * metrics.widthMm * metrics.heightMm > 0
        ? metrics.volumeMm3 /
          (metrics.lengthMm * metrics.widthMm * metrics.heightMm)
        : undefined;

  const items = [
    {
      label: "长 × 宽 × 高",
      value: `${fmt(metrics.lengthMm)} × ${fmt(metrics.widthMm)} × ${fmt(metrics.heightMm)} mm`,
    },
    { label: "体积", value: `${fmt(metrics.volumeMm3)} mm³` },
    { label: "表面积", value: `${fmt(metrics.surfaceAreaMm2)} mm²` },
    { label: "三角面数", value: fmt(metrics.triangleCount, 0) },
  ];

  if (fill !== undefined && Number.isFinite(fill)) {
    items.push({ label: "填充率", value: `${(fill * 100).toFixed(1)}%` });
  }
  if (typeof metrics.faceCount === "number") {
    items.push({ label: "面数(代理)", value: fmt(metrics.faceCount, 0) });
  }
  if (typeof metrics.cylinderCount === "number" || typeof metrics.coneCount === "number") {
    items.push({
      label: "柱/锥(代理)",
      value: `${fmt(metrics.cylinderCount ?? 0, 0)} / ${fmt(metrics.coneCount ?? 0, 0)}`,
    });
  }
  if (metrics.featureConfidence) {
    const zh =
      metrics.featureConfidence === "high"
        ? "高"
        : metrics.featureConfidence === "medium"
          ? "中"
          : "低";
    items.push({
      label: "特征置信",
      value: `${zh}${metrics.sourceFormat ? ` · ${metrics.sourceFormat.toUpperCase()}` : ""}`,
    });
  }

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
