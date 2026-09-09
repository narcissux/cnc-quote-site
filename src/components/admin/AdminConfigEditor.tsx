"use client";

import { useMemo, useState } from "react";
import { computeQuote } from "@/lib/quote/engine";
import type {
  LeadTierId,
  MaterialId,
  QuoteConfig,
  QuoteResult,
} from "@/lib/quote/types";
import rearAxle from "../../../fixtures/rear-axle-metrics.json";

function materialIds(cfg: QuoteConfig): MaterialId[] {
  return Object.keys(cfg.materials) as MaterialId[];
}

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm";

export function AdminConfigEditor({
  initial,
  onSaved,
  onError,
}: {
  initial: QuoteConfig;
  onSaved: (cfg: QuoteConfig) => void;
  onError: (msg: string | null) => void;
}) {
  const [cfg, setCfg] = useState<QuoteConfig>(() => structuredClone(initial));
  const [busy, setBusy] = useState(false);
  const [sampleQuote, setSampleQuote] = useState<QuoteResult | null>(null);
  const [sampleLead, setSampleLead] = useState<LeadTierId>("standard");

  const metrics = rearAxle.metrics;

  const preview = useMemo(() => {
    return computeQuote(
      {
        geometry: metrics,
        materialId: "Steel1045",
        quantity: 2,
        tolerance: "standard",
        finish: "as_machined",
        machine: "3axis",
        mode: "hourly",
        leadTier: sampleLead,
      },
      cfg,
    );
  }, [cfg, metrics, sampleLead]);

  function updateMaterial(
    id: MaterialId,
    key: "densityGPerCm3" | "pricePerKg" | "mrrCm3PerMin" | "hourlyRateCny" | "labelZh",
    value: string,
  ) {
    setCfg((prev) => {
      const next = structuredClone(prev);
      if (key === "labelZh") {
        next.materials[id].labelZh = value;
      } else {
        const n = Number(value);
        if (Number.isFinite(n)) next.materials[id][key] = n;
      }
      return next;
    });
  }

  async function save() {
    setBusy(true);
    onError(null);
    try {
      const res = await fetch("/api/quote-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error || "保存失败");
        return;
      }
      setCfg(data);
      onSaved(data);
    } catch {
      onError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  function recomputeSample() {
    setSampleQuote(preview);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">材料库</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-2">材料</th>
                <th className="py-2 pr-2">密度 g/cm³</th>
                <th className="py-2 pr-2">单价 ¥/kg</th>
                <th className="py-2 pr-2">MRR cm³/min</th>
                <th className="py-2 pr-2">机时 ¥/h</th>
              </tr>
            </thead>
            <tbody>
              {materialIds(cfg).map((id) => (
                <tr key={id} className="border-b border-slate-100">
                  <td className="py-2 pr-2">
                    <div className="font-mono text-xs text-slate-500">{id}</div>
                    <input
                      className={inputCls}
                      value={cfg.materials[id].labelZh}
                      onChange={(e) => updateMaterial(id, "labelZh", e.target.value)}
                    />
                  </td>
                  {(
                    [
                      "densityGPerCm3",
                      "pricePerKg",
                      "mrrCm3PerMin",
                      "hourlyRateCny",
                    ] as const
                  ).map((k) => (
                    <td key={k} className="py-2 pr-2">
                      <input
                        type="number"
                        step="any"
                        className={inputCls}
                        value={cfg.materials[id][k]}
                        onChange={(e) => updateMaterial(id, k, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">系数与费用</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <label>
              编程费 ¥
              <input
                type="number"
                className={inputCls}
                value={cfg.programmingFeeCny}
                onChange={(e) =>
                  setCfg({ ...cfg, programmingFeeCny: Number(e.target.value) })
                }
              />
            </label>
            <label>
              备料系数
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={cfg.stockFactor}
                onChange={(e) =>
                  setCfg({ ...cfg, stockFactor: Number(e.target.value) })
                }
              />
            </label>
            <label>
              切削安全系数
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={cfg.cutTimeSafety}
                onChange={(e) =>
                  setCfg({ ...cfg, cutTimeSafety: Number(e.target.value) })
                }
              />
            </label>
            <label>
              最低机时 h
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={cfg.minMachineHours}
                onChange={(e) =>
                  setCfg({ ...cfg, minMachineHours: Number(e.target.value) })
                }
              />
            </label>
            <label>
              交期基础天
              <input
                type="number"
                className={inputCls}
                value={cfg.leadBaseDays}
                onChange={(e) =>
                  setCfg({ ...cfg, leadBaseDays: Number(e.target.value) })
                }
              />
            </label>
            <label>
              机时/天
              <input
                type="number"
                className={inputCls}
                value={cfg.leadHoursPerDay}
                onChange={(e) =>
                  setCfg({ ...cfg, leadHoursPerDay: Number(e.target.value) })
                }
              />
            </label>
            <label>
              标准公差系数
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={cfg.toleranceFactor.standard}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    toleranceFactor: {
                      ...cfg.toleranceFactor,
                      standard: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              精密公差系数
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={cfg.toleranceFactor.precision}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    toleranceFactor: {
                      ...cfg.toleranceFactor,
                      precision: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-800">表面处理</h3>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            {(["as_machined", "anodize", "blast"] as const).map((id) => (
              <div key={id} className="rounded-lg border border-slate-100 p-2">
                <div className="font-medium">{cfg.finishLabel[id]}</div>
                <label className="mt-1 block">
                  工时系数
                  <input
                    type="number"
                    step="0.01"
                    className={inputCls}
                    value={cfg.finishFactor[id]}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        finishFactor: {
                          ...cfg.finishFactor,
                          [id]: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
                <label className="mt-1 block">
                  单件加价 ¥
                  <input
                    type="number"
                    className={inputCls}
                    value={cfg.finishSurchargeCny[id]}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        finishSurchargeCny: {
                          ...cfg.finishSurchargeCny,
                          [id]: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">交期三档</h2>
          <div className="mt-3 space-y-3">
            {(["rush", "standard", "economy"] as LeadTierId[]).map((id) => (
              <div
                key={id}
                className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 p-3 text-sm"
              >
                <label>
                  名称
                  <input
                    className={inputCls}
                    value={cfg.leadTiers[id].labelZh}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        leadTiers: {
                          ...cfg.leadTiers,
                          [id]: { ...cfg.leadTiers[id], labelZh: e.target.value },
                        },
                      })
                    }
                  />
                </label>
                <label>
                  价格系数
                  <input
                    type="number"
                    step="0.01"
                    className={inputCls}
                    value={cfg.leadTiers[id].priceFactor}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        leadTiers: {
                          ...cfg.leadTiers,
                          [id]: {
                            ...cfg.leadTiers[id],
                            priceFactor: Number(e.target.value),
                          },
                        },
                      })
                    }
                  />
                </label>
                <label>
                  天数偏移
                  <input
                    type="number"
                    className={inputCls}
                    value={cfg.leadTiers[id].daysOffset}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        leadTiers: {
                          ...cfg.leadTiers,
                          [id]: {
                            ...cfg.leadTiers[id],
                            daysOffset: Number(e.target.value),
                          },
                        },
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">后轴样例重算</h2>
            <p className="text-sm text-slate-500">
              使用预烘焙几何（Steel1045 · 数量 2 · 工时模式）按当前编辑中的费率试算
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              value={sampleLead}
              onChange={(e) => setSampleLead(e.target.value as LeadTierId)}
            >
              {(["rush", "standard", "economy"] as LeadTierId[]).map((id) => (
                <option key={id} value={id}>
                  {cfg.leadTiers[id].labelZh}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={recomputeSample}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              按当前费率重算
            </button>
          </div>
        </div>
        {(sampleQuote || preview) && (
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
            {(() => {
              const q = sampleQuote ?? preview;
              return (
                <>
                  <div className="text-lg font-bold">
                    总价 ¥{q.totalPriceCny.toFixed(2)} · 单价 ¥
                    {q.unitPriceCny.toFixed(2)} · 交期 {q.leadTimeDays} 天
                  </div>
                  <ul className="mt-2 space-y-1 text-slate-700">
                    {q.lines.map((l) => (
                      <li key={l.id} className="flex justify-between gap-4">
                        <span>
                          {l.label}
                          <span className="ml-2 text-xs text-slate-500">
                            {l.formula}
                          </span>
                        </span>
                        <span className="font-medium">¥{l.amountCny.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              );
            })()}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "保存中…" : "保存费率配置"}
        </button>
      </div>
    </div>
  );
}
