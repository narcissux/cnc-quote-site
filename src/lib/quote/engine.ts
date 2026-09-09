/**
 * CNC instant quote engine (approximate).
 *
 * Time heuristic is NOT CAM cycle time — it estimates from removed stock volume
 * and material MRR. Documented as approximate for MVP quoting only.
 *
 * CutTime_min = (removed_cm³ / MRR) × finish_factor × safety × tolerance_factor
 * stock = bbox_volume × stockFactor
 * removed = max(stock − part_volume, 0)
 */

import { DEFAULT_QUOTE_CONFIG } from "./config";
import type {
  GeometryMetrics,
  LeadTierId,
  QuoteConfig,
  QuoteInput,
  QuoteLine,
  QuoteResult,
} from "./types";

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

function cfgOrDefault(config?: QuoteConfig): QuoteConfig {
  return config ?? DEFAULT_QUOTE_CONFIG;
}

/**
 * Approximate cut time in minutes from removed stock.
 * When includeTolerance is false, omits tolerance factor so callers can apply
 * MIN_MACHINE_HOURS first, then multiply by tolerance (monotonic for tiny parts).
 */
export function estimateCutTimeMin(
  input: QuoteInput,
  includeTolerance: boolean = true,
  config?: QuoteConfig,
): number {
  const cfg = cfgOrDefault(config);
  const mat = cfg.materials[input.materialId];
  const bbox = bboxVolumeMm3(input.geometry);
  const stockMm3 = bbox * cfg.stockFactor;
  const removedMm3 = Math.max(stockMm3 - input.geometry.volumeMm3, 0);
  const removedCm3 = removedMm3 / 1000;

  const finishF = cfg.finishFactor[input.finish];
  const tolF = includeTolerance ? cfg.toleranceFactor[input.tolerance] : 1;

  if (mat.mrrCm3PerMin <= 0) return 0;

  return (removedCm3 / mat.mrrCm3PerMin) * finishF * cfg.cutTimeSafety * tolF;
}

/** Material cost for one piece (¥), based on stock mass. */
export function materialCostPerPiece(
  input: QuoteInput,
  config?: QuoteConfig,
): number {
  const cfg = cfgOrDefault(config);
  const mat = cfg.materials[input.materialId];
  const bbox = bboxVolumeMm3(input.geometry);
  const stockMm3 = bbox * cfg.stockFactor;
  const stockCm3 = stockMm3 / 1000;
  const massKg = (stockCm3 * mat.densityGPerCm3) / 1000;
  return massKg * mat.pricePerKg;
}

function baseLeadTimeDays(
  totalMachineHours: number,
  qty: number,
  cfg: QuoteConfig,
): number {
  const extra = Math.ceil(totalMachineHours / cfg.leadHoursPerDay);
  const qtyBump = qty > 50 ? 2 : qty > 10 ? 1 : 0;
  return cfg.leadBaseDays + extra + qtyBump;
}

export function computeQuote(
  input: QuoteInput,
  config?: QuoteConfig,
): QuoteResult {
  const cfg = cfgOrDefault(config);
  const qty = Math.min(1000, Math.max(1, Math.floor(input.quantity)));
  const mat = cfg.materials[input.materialId];
  const tolF = cfg.toleranceFactor[input.tolerance];
  const leadTier: LeadTierId = input.leadTier ?? "standard";
  const tier = cfg.leadTiers[leadTier] ?? cfg.leadTiers.standard;

  const cutMin = estimateCutTimeMin({ ...input, quantity: qty }, true, cfg);
  const baseCutMin = estimateCutTimeMin({ ...input, quantity: qty }, false, cfg);
  const baseHours = (baseCutMin / 60) * qty;
  const totalMachineHours = Math.max(baseHours, cfg.minMachineHours) * tolF;
  const hoursPerPiece = totalMachineHours / qty;

  const rate = mat.hourlyRateCny * cfg.machineRateMultiplier[input.machine];
  const matCost1 = materialCostPerPiece(input, cfg);
  const finish1 = cfg.finishSurchargeCny[input.finish];
  const programming = cfg.programmingFeeCny;

  const materialTotal = matCost1 * qty;
  const finishTotal = finish1 * qty;
  const machineCost = totalMachineHours * rate;

  // Unified 5-line breakdown (totals). Per-piece mode still reports unit = total/qty.
  const subtotalBeforeLead =
    programming + machineCost + materialTotal + finishTotal;
  const leadSurcharge = subtotalBeforeLead * (tier.priceFactor - 1);
  const totalPriceCny = subtotalBeforeLead + leadSurcharge;
  const unitPriceCny = totalPriceCny / qty;

  const rawDays = baseLeadTimeDays(totalMachineHours, qty, cfg) + tier.daysOffset;
  const leadTimeDays = Math.max(1, rawDays);

  const notes: string[] = [
    "工时为基于去除材料体积与材料去除率（MRR）的近似估算，非 CAM 真实循环时间。",
    `毛坯体积 = 包围盒体积 × ${cfg.stockFactor}；去除量 = max(毛坯 − 零件体积, 0)。`,
    `切削时间(分) = (去除体积cm³ / MRR) × 表面系数 × ${cfg.cutTimeSafety} × 公差系数。`,
    `交期档「${tier.labelZh}」：价格系数 ${tier.priceFactor}，交期偏移 ${tier.daysOffset >= 0 ? "+" : ""}${tier.daysOffset} 天。`,
  ];

  const lines: QuoteLine[] = [
    {
      id: "material",
      label: "材料费",
      amountCny: round2(materialTotal),
      formula: `¥${round2(matCost1)}/件 × ${qty}（毛坯质量 × ¥${mat.pricePerKg}/kg）`,
    },
    {
      id: "machine",
      label: "机床工时费",
      amountCny: round2(machineCost),
      formula: `${round2(totalMachineHours)} h × ¥${round0(rate)}/h（${input.machine === "5axis" ? "5轴" : "3轴"}）`,
    },
    {
      id: "programming",
      label: "编程/开档费",
      amountCny: round2(programming),
      formula: `固定 ¥${programming}${input.mode === "per_piece" ? `（摊至单价 ¥${round2(programming / qty)}）` : ""}`,
    },
    {
      id: "finish",
      label: "表面处理",
      amountCny: round2(finishTotal),
      formula:
        finishTotal > 0
          ? `¥${finish1}/件 × ${qty}`
          : "毛坯无加价",
    },
    {
      id: "lead",
      label: "交期加价",
      amountCny: round2(leadSurcharge),
      formula: `${tier.labelZh} ×${tier.priceFactor}（相对材料+机时+编程+表面小计）`,
    },
  ];

  return {
    mode: input.mode,
    currency: "CNY",
    unitPriceCny: round2(unitPriceCny),
    totalPriceCny: round2(totalPriceCny),
    leadTimeDays,
    leadTier,
    confidencePct: cfg.confidencePct,
    cutTimeMin: round2(cutMin),
    machineHours: round2(totalMachineHours),
    lines,
    notes,
  };
}
