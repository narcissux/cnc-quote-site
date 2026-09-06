"use client";

import {
  FINISH_LABEL,
  MACHINE_LABEL,
  MATERIALS,
  TOLERANCE_LABEL,
} from "@/lib/quote/config";
import type {
  FinishId,
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
}

interface QuoteFormProps {
  value: QuoteFormState;
  onChange: (next: QuoteFormState) => void;
}

const selectCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

export function QuoteForm({ value, onChange }: QuoteFormProps) {
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
          {(Object.keys(MATERIALS) as MaterialId[]).map((id) => (
            <option key={id} value={id}>
              {MATERIALS[id].labelZh}
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
            {(Object.keys(TOLERANCE_LABEL) as ToleranceId[]).map((id) => (
              <option key={id} value={id}>
                {TOLERANCE_LABEL[id]}
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
            {(Object.keys(FINISH_LABEL) as FinishId[]).map((id) => (
              <option key={id} value={id}>
                {FINISH_LABEL[id]}
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
          {(Object.keys(MACHINE_LABEL) as MachineId[]).map((id) => (
            <option key={id} value={id}>
              {MACHINE_LABEL[id]}
              {id === "5axis" ? "（可选加价）" : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
