/**
 * CNC instant quote engine P0 (approximate).
 *
 * Time split (not CAM cycle time):
 *   T_rough_min  = (removed_cm³ / MRR) × safety
 *   T_finish_min = surfaceAreaMm² / (finishFeed × stepover) × finishFactor × complexity
 *   T_clamp_min  = clampMinutesPerPc × clampFactor
 *   T_inspect_min = by tolerance (configurable)
 *
 * Billing:
 *   setupOrProgramming = hourly ? (programmingMinutes/60)×rate : programmingFeeCny
 *   runHoursPerPc = max((T_rough+T_finish+T_clamp+T_inspect)/60, minRunHoursPerPc) × tolFactor
 *   total = material×qty + run×qty×rate + setup + finish×qty + lead + minOrderTopUp
 */

import { DEFAULT_QUOTE_CONFIG } from "./config";
import type {
  GeometryMetrics,
  LeadTierId,
  QuoteConfig,
  QuoteInput,
  QuoteLine,
  QuoteResult,
  TimeBreakdown,
} from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round0(n: number): number {
  return Math.round(n);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Bounding-box volume in mm³. */
export function bboxVolumeMm3(g: GeometryMetrics): number {
  return g.lengthMm * g.widthMm * g.heightMm;
}

export function fillRatioOf(g: GeometryMetrics): number {
  if (typeof g.fillRatio === "number" && Number.isFinite(g.fillRatio) && g.fillRatio > 0) {
    return g.fillRatio;
  }
  const bbox = bboxVolumeMm3(g);
  if (bbox <= 0) return 1;
  return Math.min(1, Math.max(0, g.volumeMm3 / bbox));
}

function cfgOrDefault(config?: QuoteConfig): QuoteConfig {
  return config ?? DEFAULT_QUOTE_CONFIG;
}

export function computeComplexityFactor(
  g: GeometryMetrics,
  config?: QuoteConfig,
): number {
  const cfg = cfgOrDefault(config).complexity;
  const fill = fillRatioOf(g);
  const cyl = (g.cylinderCount ?? 0) + (g.coneCount ?? 0);
  const fillTerm =
    fill < cfg.fillRatioRef
      ? cfg.fillRatioWeight * ((cfg.fillRatioRef - fill) / cfg.fillRatioRef)
      : 0;
  const triTerm =
    cfg.triangleWeight * Math.min(1, g.triangleCount / Math.max(1, cfg.triangleRef));
  const cylTerm =
    cfg.cylinderConeWeight * Math.min(1, cyl / Math.max(1, cfg.cylinderConeRef));
  const raw = 1 + fillTerm + triTerm + cylTerm;
  return Math.min(cfg.maxFactor, Math.max(cfg.minFactor, raw));
}

/** Removed stock volume in cm³. */
export function removedVolumeCm3(
  input: QuoteInput,
  config?: QuoteConfig,
): number {
  const cfg = cfgOrDefault(config);
  const bbox = bboxVolumeMm3(input.geometry);
  const stockMm3 = bbox * cfg.stockFactor;
  const removedMm3 = Math.max(stockMm3 - input.geometry.volumeMm3, 0);
  return removedMm3 / 1000;
}

/**
 * Roughing minutes only: (removed_cm³ / MRR) × safety.
 * Does NOT fold finishFactor or tolerance (those apply elsewhere).
 */
export function estimateRoughMin(
  input: QuoteInput,
  config?: QuoteConfig,
): number {
  const cfg = cfgOrDefault(config);
  const mat = cfg.materials[input.materialId];
  if (mat.mrrCm3PerMin <= 0) return 0;
  return (removedVolumeCm3(input, cfg) / mat.mrrCm3PerMin) * cfg.cutTimeSafety;
}

/**
 * Finish minutes: Area / (feed × stepover) × finishFactor × complexity (if applyTo=finish).
 */
export function estimateFinishMin(
  input: QuoteInput,
  complexityFactor: number,
  config?: QuoteConfig,
): number {
  const cfg = cfgOrDefault(config);
  const feed = cfg.finishFeedMmPerMin;
  const step = cfg.stepoverMm;
  if (feed <= 0 || step <= 0) return 0;
  const finishF = cfg.finishFactor[input.finish];
  let t = (input.geometry.surfaceAreaMm2 / (feed * step)) * finishF;
  if (cfg.complexity.applyTo === "finish") {
    t *= complexityFactor;
  }
  return t;
}

export function estimateClampMin(config?: QuoteConfig): number {
  const cfg = cfgOrDefault(config);
  return cfg.clampMinutesPerPc * cfg.clampFactor;
}

export function estimateInspectMin(
  input: QuoteInput,
  config?: QuoteConfig,
): number {
  const cfg = cfgOrDefault(config);
  return input.tolerance === "precision"
    ? cfg.inspectMinutesPrecision
    : cfg.inspectMinutesStandard;
}

/** Full per-piece time breakdown (minutes / hours). */
export function estimateTimeBreakdown(
  input: QuoteInput,
  config?: QuoteConfig,
): TimeBreakdown {
  const cfg = cfgOrDefault(config);
  const fillRatio = fillRatioOf(input.geometry);
  const complexityFactor = computeComplexityFactor(input.geometry, cfg);
  const roughMin = estimateRoughMin(input, cfg);
  let finishMin = estimateFinishMin(input, complexityFactor, cfg);
  const clampMin = estimateClampMin(cfg);
  const inspectMin = estimateInspectMin(input, cfg);

  let featureExtra = 0;
  if (cfg.complexity.applyTo === "feature" && complexityFactor > 1) {
    featureExtra = cfg.complexity.featureMinutesBase * (complexityFactor - 1);
    finishMin += featureExtra;
  }

  const runMinRaw = roughMin + finishMin + clampMin + inspectMin;
  const tolF = cfg.toleranceFactor[input.tolerance];
  const hoursBeforeFloor = runMinRaw / 60;
  const runHoursPerPc =
    Math.max(hoursBeforeFloor, cfg.minRunHoursPerPc) * tolF;

  return {
    roughMin,
    finishMin,
    clampMin,
    inspectMin,
    runMinRaw,
    runHoursPerPc,
    complexityFactor,
    fillRatio,
  };
}

/**
 * @deprecated Prefer estimateRoughMin / estimateFinishMin / estimateTimeBreakdown.
 * Returns rough+finish minutes (cutting-related, no clamp/inspect, no tol).
 */
export function estimateCutTimeMin(
  input: QuoteInput,
  _includeTolerance: boolean = true,
  config?: QuoteConfig,
): number {
  const cfg = cfgOrDefault(config);
  const cx = computeComplexityFactor(input.geometry, cfg);
  const rough = estimateRoughMin(input, cfg);
  const finish = estimateFinishMin(input, cx, cfg);
  // Legacy tests expected tol in the return when includeTolerance=true.
  const tolF = _includeTolerance ? cfg.toleranceFactor[input.tolerance] : 1;
  return (rough + finish) * tolF;
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
  const leadTier: LeadTierId = input.leadTier ?? "standard";
  const tier = cfg.leadTiers[leadTier] ?? cfg.leadTiers.standard;

  const tb = estimateTimeBreakdown({ ...input, quantity: qty }, cfg);
  const billableHours = tb.runHoursPerPc * qty;
  const rate = mat.hourlyRateCny * cfg.machineRateMultiplier[input.machine];

  // Mode fork: hourly bills programming as time×rate; per_piece as flat fee.
  const setupOrProgramming =
    input.mode === "hourly"
      ? (cfg.programmingMinutes / 60) * rate
      : cfg.programmingFeeCny;

  const matCost1 = materialCostPerPiece(input, cfg);
  const finish1 = cfg.finishSurchargeCny[input.finish];

  const materialTotal = matCost1 * qty;
  const finishTotal = finish1 * qty;
  const machineCost = billableHours * rate;

  const subtotalBeforeLead =
    setupOrProgramming + machineCost + materialTotal + finishTotal;
  const leadSurcharge = subtotalBeforeLead * (tier.priceFactor - 1);
  const afterLead = subtotalBeforeLead + leadSurcharge;

  let minOrderTopUp = 0;
  if (cfg.minOrderFeeCny > 0 && afterLead < cfg.minOrderFeeCny) {
    minOrderTopUp = cfg.minOrderFeeCny - afterLead;
  }

  const totalPriceCny = afterLead + minOrderTopUp;
  const unitPriceCny = totalPriceCny / qty;

  const rawDays = baseLeadTimeDays(billableHours, qty, cfg) + tier.daysOffset;
  const leadTimeDays = Math.max(1, rawDays);

  const confNote =
    input.geometry.featureConfidence === "low"
      ? "特征代理置信度偏低（STL 网格代理）。"
      : input.geometry.featureConfidence === "medium"
        ? "特征代理置信度中等（STEP 面计数 + 网格曲率代理）。"
        : input.geometry.sourceFormat === "step"
          ? "特征代理来自 STEP BREP 面 + 曲率启发式。"
          : "特征代理基于网格填充率/三角面。";

  const notes: string[] = [
    "工时为近似估算（开粗体积/MRR + 精修面积路径 + 装夹 + 检验），非 CAM 真实循环时间。",
    `开粗(分) = (去除体积cm³ / MRR) × ${cfg.cutTimeSafety}；精修(分) = 表面积 / (${cfg.finishFeedMmPerMin}×${cfg.stepoverMm}) × 表面系数 × 复杂度。`,
    `装夹(分) = ${cfg.clampMinutesPerPc} × ${cfg.clampFactor}；检验(分) = 标准 ${cfg.inspectMinutesStandard} / 精密 ${cfg.inspectMinutesPrecision}。`,
    `每件机时 = max(分项合计/60, ${cfg.minRunHoursPerPc}) × 公差系数；复杂度=${round2(tb.complexityFactor)}（填充率 ${round2(tb.fillRatio)}）。`,
    input.mode === "hourly"
      ? `计价模式「工时」：编程按 ${cfg.programmingMinutes} 分钟 × 台时费率（一次性）。`
      : `计价模式「按件」：编程固定 ¥${cfg.programmingFeeCny}，摊入单价（÷${qty}）。`,
    confNote,
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
      formula:
        input.mode === "hourly"
          ? `${round2(billableHours)} h × ¥${round0(rate)}/h（开粗 ${round2(tb.roughMin)} + 精修 ${round2(tb.finishMin)} + 装夹 ${round2(tb.clampMin)} + 检验 ${round2(tb.inspectMin)} 分/件）`
          : `${round2(tb.runHoursPerPc)} h/件 × ${qty} × ¥${round0(rate)}/h`,
    },
    {
      id: "programming",
      label: "编程/开档费",
      amountCny: round2(setupOrProgramming),
      formula:
        input.mode === "hourly"
          ? `${cfg.programmingMinutes} 分钟 × ¥${round0(rate)}/h（一次性）`
          : `固定 ¥${cfg.programmingFeeCny}${qty > 1 ? `（摊至单价 ¥${round2(setupOrProgramming / qty)}）` : ""}`,
    },
    {
      id: "finish",
      label: "表面处理",
      amountCny: round2(finishTotal),
      formula:
        finishTotal > 0 ? `¥${finish1}/件 × ${qty}` : "毛坯无加价",
    },
    {
      id: "lead",
      label: "交期加价",
      amountCny: round2(leadSurcharge),
      formula: `${tier.labelZh} ×${tier.priceFactor}（相对材料+机时+编程+表面小计）`,
    },
  ];

  if (minOrderTopUp > 0 || cfg.minOrderFeeCny > 0) {
    lines.push({
      id: "min_order",
      label: "起步价补差",
      amountCny: round2(minOrderTopUp),
      formula:
        minOrderTopUp > 0
          ? `整单起步 ¥${cfg.minOrderFeeCny}，补差 ¥${round2(minOrderTopUp)}`
          : `整单起步 ¥${cfg.minOrderFeeCny}（已满足，补差 0）`,
    });
  }

  // Confidence: STL slightly lower
  let confidencePct = cfg.confidencePct;
  if (input.geometry.featureConfidence === "low") {
    confidencePct = Math.max(40, confidencePct - 10);
  } else if (input.geometry.featureConfidence === "medium") {
    confidencePct = Math.max(45, confidencePct - 5);
  }

  return {
    mode: input.mode,
    currency: "CNY",
    unitPriceCny: round2(unitPriceCny),
    totalPriceCny: round2(totalPriceCny),
    leadTimeDays,
    leadTier,
    confidencePct,
    cutTimeMin: round2(tb.roughMin + tb.finishMin),
    machineHours: round2(billableHours),
    billableHours: round2(billableHours),
    roughMin: round2(tb.roughMin),
    finishMin: round2(tb.finishMin),
    clampMin: round2(tb.clampMin),
    inspectMin: round2(tb.inspectMin),
    runHoursPerPc: round4(tb.runHoursPerPc),
    setupOrProgrammingCny: round2(setupOrProgramming),
    complexityFactor: round2(tb.complexityFactor),
    fillRatio: round4(tb.fillRatio),
    lines,
    notes,
  };
}
