"use client";

import type { QuoteConfig } from "@/lib/quote/types";
import type {
  FinishId,
  LeadTierId,
  MachineId,
  MaterialId,
  PricingMode,
  ToleranceId,
} from "@/lib/quote/types";

export interface QuoteFormState {
  materialId: MaterialId;
  quantity: number;
  tolerance: ToleranceId;
  finish: FinishId;
  machine: MachineId;
  mode: PricingMode;
  leadTier: LeadTierId;
}

interface QuoteFormProps {
  value: QuoteFormState;
  onChange: (next: QuoteFormState) => void;
  config: QuoteConfig;
}

const selectCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

export function QuoteForm({ value, onChange, config }: QuoteFormProps) {
  const set = <K extends keyof QuoteFormState>(key: K, v: QuoteFormState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700">报价模式</label>
        <div className="mt-1 flex gap-2">
          {(
            [
              ["hourly", "工时"],
              ["per_piece", "按件"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => set("mode", id)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                value.mode === id
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">材料</label>
        <select
          className={selectCls}
          value={value.materialId}
          onChange={(e) => set("materialId", e.target.value as MaterialId)}
        >
          {(Object.keys(config.materials) as MaterialId[]).map((id) => (
            <option key={id} value={id}>
              {config.materials[id].labelZh}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">数量（1–1000）</label>
        <input
          type="number"
          min={1}
          max={1000}
          className={selectCls}
          value={value.quantity}
          onChange={(e) =>
            set("quantity", Math.min(1000, Math.max(1, Number(e.target.value) || 1)))
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-slate-700">公差</label>
          <select
            className={selectCls}
            value={value.tolerance}
            onChange={(e) => set("tolerance", e.target.value as ToleranceId)}
          >
            {(Object.keys(config.toleranceLabel) as ToleranceId[]).map((id) => (
              <option key={id} value={id}>
                {config.toleranceLabel[id]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">表面处理</label>
          <select
            className={selectCls}
            value={value.finish}
            onChange={(e) => set("finish", e.target.value as FinishId)}
          >
            {(Object.keys(config.finishLabel) as FinishId[]).map((id) => (
              <option key={id} value={id}>
                {config.finishLabel[id]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">机床</label>
        <select
          className={selectCls}
          value={value.machine}
          onChange={(e) => set("machine", e.target.value as MachineId)}
        >
          {(Object.keys(config.machineLabel) as MachineId[]).map((id) => (
            <option key={id} value={id}>
              {config.machineLabel[id]}
              {id === "5axis" ? "（可选加价）" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">交期</label>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {(Object.keys(config.leadTiers) as LeadTierId[]).map((id) => {
            const t = config.leadTiers[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => set("leadTier", id)}
                className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
                  value.leadTier === id
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div>{t.labelZh}</div>
                <div className="text-[10px] opacity-80">×{t.priceFactor}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
