/**
 * CNC instant quote engine (approximate).
 *
 * Time heuristic is NOT CAM cycle time — it estimates from removed stock volume
 * and material MRR. Documented as approximate for MVP quoting only.
 *
 * CutTime_min = (removed_cm³ / MRR) × finish_factor × 1.2 × tolerance_factor
 * stock = bbox_volume × 1.15
 * removed = max(stock − part_volume, 0)
 */

import {
  CONFIDENCE_PCT,
  CUT_TIME_SAFETY,
  FINISH_FACTOR,
  FINISH_SURCHARGE_CNY,
  LEAD_BASE_DAYS,
  LEAD_HOURS_PER_DAY,
  MACHINE_RATE_MULTIPLIER,
  MATERIALS,
  MIN_MACHINE_HOURS,
  PROGRAMMING_FEE_CNY,
  STOCK_FACTOR,
  TOLERANCE_FACTOR,
} from "./config";
import type { GeometryMetrics, QuoteInput, QuoteLine, QuoteResult } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round0(n: number): number {
  return Math.round(n);
}

/** Bounding-box volume in mm³. */
export function bboxVolumeMm3(g: GeometryMetrics): number {
  return g.lengthMm * g.widthMm * g.heightMm;
}

/**
 * Approximate cut time in minutes from removed stock.
 * Units: volume mm³ → cm³ (/1000); MRR in cm³/min.
 */
export function estimateCutTimeMin(input: QuoteInput): number {
  const mat = MATERIALS[input.materialId];
  const bbox = bboxVolumeMm3(input.geometry);
  const stockMm3 = bbox * STOCK_FACTOR;
  const removedMm3 = Math.max(stockMm3 - input.geometry.volumeMm3, 0);
  const removedCm3 = removedMm3 / 1000;

  const finishF = FINISH_FACTOR[input.finish];
  const tolF = TOLERANCE_FACTOR[input.tolerance];

  if (mat.mrrCm3PerMin <= 0) return 0;

  return (removedCm3 / mat.mrrCm3PerMin) * finishF * CUT_TIME_SAFETY * tolF;
}

/** Material cost for one piece (¥), based on stock mass. */
export function materialCostPerPiece(input: QuoteInput): number {
  const mat = MATERIALS[input.materialId];
  const bbox = bboxVolumeMm3(input.geometry);
  const stockMm3 = bbox * STOCK_FACTOR;
  const stockCm3 = stockMm3 / 1000;
  const massKg = (stockCm3 * mat.densityGPerCm3) / 1000;
  return massKg * mat.pricePerKg;
}

function leadTimeDays(totalMachineHours: number, qty: number): number {
  const batchHours = totalMachineHours;
  const extra = Math.ceil(batchHours / LEAD_HOURS_PER_DAY);
  // Slight qty bump for larger lots
  const qtyBump = qty > 50 ? 2 : qty > 10 ? 1 : 0;
  return LEAD_BASE_DAYS + extra + qtyBump;
}

export function computeQuote(input: QuoteInput): QuoteResult {
  const qty = Math.min(1000, Math.max(1, Math.floor(input.quantity)));
  const mat = MATERIALS[input.materialId];
  const cutMin = estimateCutTimeMin({ ...input, quantity: qty });
  const machineHoursPerPiece = Math.max(cutMin / 60, MIN_MACHINE_HOURS / Math.max(qty, 1));
  // Prefer piece hours from cut time; enforce a job-level floor later
  const rawHoursPerPiece = cutMin / 60;
  const hoursPerPiece = Math.max(rawHoursPerPiece, 0.05);
  const totalMachineHours = Math.max(hoursPerPiece * qty, MIN_MACHINE_HOURS);

  const rate =
    mat.hourlyRateCny * MACHINE_RATE_MULTIPLIER[input.machine];
  const matCost1 = materialCostPerPiece(input);
  const finish1 = FINISH_SURCHARGE_CNY[input.finish];
  const programming = PROGRAMMING_FEE_CNY;

  const notes: string[] = [
    "工时为基于去除材料体积与材料去除率（MRR）的近似估算，非 CAM 真实循环时间。",
    `毛坯体积 = 包围盒体积 × ${STOCK_FACTOR}；去除量 = max(毛坯 − 零件体积, 0)。`,
    `切削时间(分) = (去除体积cm³ / MRR) × 表面系数 × ${CUT_TIME_SAFETY} × 公差系数。`,
  ];

  let unitPriceCny: number;
  let totalPriceCny: number;
  const lines: QuoteLine[] = [];

  if (input.mode === "hourly") {
    const machineCost = totalMachineHours * rate;
    const materialTotal = matCost1 * qty;
    const finishTotal = finish1 * qty;
    totalPriceCny = programming + machineCost + materialTotal + finishTotal;
    unitPriceCny = totalPriceCny / qty;

    lines.push({
      id: "programming",
      label: "编程/调试费",
      amountCny: round2(programming),
      formula: `固定 ¥${PROGRAMMING_FEE_CNY}`,
    });
    lines.push({
      id: "machine",
      label: "机床工时费",
      amountCny: round2(machineCost),
      formula: `${round2(totalMachineHours)} h × ¥${round0(rate)}/h（${input.machine === "5axis" ? "5轴" : "3轴"}）`,
    });
    lines.push({
      id: "material",
      label: "材料费",
      amountCny: round2(materialTotal),
      formula: `¥${round2(matCost1)}/件 × ${qty}（毛坯质量 × ¥${mat.pricePerKg}/kg）`,
    });
    if (finishTotal > 0) {
      lines.push({
        id: "finish",
        label: "表面处理",
        amountCny: round2(finishTotal),
        formula: `¥${finish1}/件 × ${qty}`,
      });
    }
  } else {
    // per-piece: amortize programming + setup into unit
    const machinePerPiece = hoursPerPiece * rate;
    const amortizedProg = programming / qty;
    unitPriceCny = amortizedProg + machinePerPiece + matCost1 + finish1;
    totalPriceCny = unitPriceCny * qty;

    lines.push({
      id: "unit_prog",
      label: "编程分摊",
      amountCny: round2(amortizedProg),
      formula: `¥${PROGRAMMING_FEE_CNY} ÷ ${qty} 件`,
    });
    lines.push({
      id: "unit_machine",
      label: "单件机时费",
      amountCny: round2(machinePerPiece),
      formula: `${round2(hoursPerPiece)} h × ¥${round0(rate)}/h`,
    });
    lines.push({
      id: "unit_material",
      label: "单件材料费",
      amountCny: round2(matCost1),
      formula: `毛坯质量 × ¥${mat.pricePerKg}/kg`,
    });
    if (finish1 > 0) {
      lines.push({
        id: "unit_finish",
        label: "单件表面处理",
        amountCny: round2(finish1),
        formula: `固定 ¥${finish1}/件`,
      });
    }
    lines.push({
      id: "unit_total",
      label: "单价小计",
      amountCny: round2(unitPriceCny),
      formula: "编程分摊 + 机时 + 材料 + 表面",
    });
  }

  return {
    mode: input.mode,
    currency: "CNY",
    unitPriceCny: round2(unitPriceCny),
    totalPriceCny: round2(totalPriceCny),
    leadTimeDays: leadTimeDays(totalMachineHours, qty),
    confidencePct: CONFIDENCE_PCT,
    cutTimeMin: round2(cutMin),
    machineHours: round2(totalMachineHours),
    lines,
    notes,
  };
}
