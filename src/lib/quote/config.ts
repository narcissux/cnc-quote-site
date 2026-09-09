import type {
  ComplexityConfig,
  FinishId,
  LeadTierId,
  MachineId,
  MaterialId,
  QuoteConfig,
  ToleranceId,
} from "./types";

export type { MaterialConfig, LeadTierConfig, QuoteConfig, ComplexityConfig } from "./types";

export const MATERIALS: QuoteConfig["materials"] = {
  Al6061: {
    id: "Al6061",
    labelZh: "铝合金 6061",
    densityGPerCm3: 2.7,
    pricePerKg: 35,
    mrrCm3PerMin: 8,
    hourlyRateCny: 120,
  },
  Al7075: {
    id: "Al7075",
    labelZh: "铝合金 7075",
    densityGPerCm3: 2.81,
    pricePerKg: 55,
    mrrCm3PerMin: 6,
    hourlyRateCny: 140,
  },
  Steel1045: {
    id: "Steel1045",
    labelZh: "碳钢 1045",
    densityGPerCm3: 7.85,
    pricePerKg: 12,
    mrrCm3PerMin: 3,
    hourlyRateCny: 150,
  },
  SS304: {
    id: "SS304",
    labelZh: "不锈钢 304",
    densityGPerCm3: 8.0,
    pricePerKg: 28,
    mrrCm3PerMin: 2,
    hourlyRateCny: 180,
  },
  BrassC360: {
    id: "BrassC360",
    labelZh: "黄铜 C360",
    densityGPerCm3: 8.5,
    pricePerKg: 70,
    mrrCm3PerMin: 7,
    hourlyRateCny: 130,
  },
};

export const TOLERANCE_FACTOR: Record<ToleranceId, number> = {
  standard: 1.0,
  precision: 1.35,
};

export const TOLERANCE_LABEL: Record<ToleranceId, string> = {
  standard: "标准",
  precision: "精密",
};

export const FINISH_FACTOR: Record<FinishId, number> = {
  as_machined: 1.0,
  anodize: 1.1,
  blast: 1.05,
};

export const FINISH_LABEL: Record<FinishId, string> = {
  as_machined: "毛坯",
  anodize: "阳极氧化",
  blast: "喷砂",
};

/** Flat finish surcharge per piece (¥), before qty. */
export const FINISH_SURCHARGE_CNY: Record<FinishId, number> = {
  as_machined: 0,
  anodize: 25,
  blast: 12,
};

export const MACHINE_RATE_MULTIPLIER: Record<MachineId, number> = {
  "3axis": 1.0,
  "5axis": 1.45,
};

export const MACHINE_LABEL: Record<MachineId, string> = {
  "3axis": "3轴",
  "5axis": "5轴",
};

/** per_piece：固定编程 / 开档费 (¥) per job. */
export const PROGRAMMING_FEE_CNY = 150;

/** hourly：一次性编程工时（分钟）. */
export const PROGRAMMING_MINUTES = 90;

/** Stock oversize factor on bounding-box volume. */
export const STOCK_FACTOR = 1.15;

/** Safety / inefficiency factor on rough cut time only. */
export const CUT_TIME_SAFETY = 1.2;

/** Finish path feed (mm/min) and stepover (mm). */
export const FINISH_FEED_MM_PER_MIN = 1500;
export const STEPOVER_MM = 0.4;

/** Clamp / inspect defaults (minutes per piece). */
export const CLAMP_MINUTES_PER_PC = 10;
export const CLAMP_FACTOR = 1.0;
export const INSPECT_MINUTES_STANDARD = 2;
export const INSPECT_MINUTES_PRECISION = 8;

/** Floor only on per-piece run hours (not order-level). */
export const MIN_RUN_HOURS_PER_PC = 0.05;

/** Order minimum fee (¥); 0 = off. */
export const MIN_ORDER_FEE_CNY = 0;

/** Lead time: base days + days per machine-hour batch. */
export const LEAD_BASE_DAYS = 3;
export const LEAD_HOURS_PER_DAY = 6;

/** Quote confidence band (±%). */
export const CONFIDENCE_PCT = 70;

export const DEFAULT_COMPLEXITY: ComplexityConfig = {
  applyTo: "finish",
  fillRatioRef: 0.55,
  fillRatioWeight: 0.35,
  triangleRef: 8000,
  triangleWeight: 0.25,
  cylinderConeRef: 6,
  cylinderConeWeight: 0.3,
  minFactor: 1.0,
  maxFactor: 1.75,
  featureMinutesBase: 3,
};

export const LEAD_TIERS: QuoteConfig["leadTiers"] = {
  rush: {
    id: "rush",
    labelZh: "加急",
    priceFactor: 1.3,
    daysOffset: -2,
  },
  standard: {
    id: "standard",
    labelZh: "标准",
    priceFactor: 1.0,
    daysOffset: 0,
  },
  economy: {
    id: "economy",
    labelZh: "经济",
    priceFactor: 0.92,
    daysOffset: 4,
  },
};

/** Built-in default quote config (fallback when data/quote-config.json missing). */
export const DEFAULT_QUOTE_CONFIG: QuoteConfig = {
  materials: structuredClone(MATERIALS),
  toleranceFactor: { ...TOLERANCE_FACTOR },
  toleranceLabel: { ...TOLERANCE_LABEL },
  finishFactor: { ...FINISH_FACTOR },
  finishLabel: { ...FINISH_LABEL },
  finishSurchargeCny: { ...FINISH_SURCHARGE_CNY },
  machineRateMultiplier: { ...MACHINE_RATE_MULTIPLIER },
  machineLabel: { ...MACHINE_LABEL },
  programmingFeeCny: PROGRAMMING_FEE_CNY,
  programmingMinutes: PROGRAMMING_MINUTES,
  stockFactor: STOCK_FACTOR,
  cutTimeSafety: CUT_TIME_SAFETY,
  finishFeedMmPerMin: FINISH_FEED_MM_PER_MIN,
  stepoverMm: STEPOVER_MM,
  clampMinutesPerPc: CLAMP_MINUTES_PER_PC,
  clampFactor: CLAMP_FACTOR,
  inspectMinutesStandard: INSPECT_MINUTES_STANDARD,
  inspectMinutesPrecision: INSPECT_MINUTES_PRECISION,
  minRunHoursPerPc: MIN_RUN_HOURS_PER_PC,
  minOrderFeeCny: MIN_ORDER_FEE_CNY,
  leadBaseDays: LEAD_BASE_DAYS,
  leadHoursPerDay: LEAD_HOURS_PER_DAY,
  confidencePct: CONFIDENCE_PCT,
  leadTiers: structuredClone(LEAD_TIERS),
  complexity: structuredClone(DEFAULT_COMPLEXITY),
};

export function cloneDefaultQuoteConfig(): QuoteConfig {
  return structuredClone(DEFAULT_QUOTE_CONFIG);
}
