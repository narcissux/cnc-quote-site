import type { FinishId, MachineId, MaterialId, ToleranceId } from "./types";

export interface MaterialConfig {
  id: MaterialId;
  labelZh: string;
  /** Density g/cm³ */
  densityGPerCm3: number;
  /** Material price ¥/kg */
  pricePerKg: number;
  /** Material removal rate cm³/min (rough heuristic) */
  mrrCm3PerMin: number;
  /** Base machine hourly rate ¥/h for this material difficulty */
  hourlyRateCny: number;
}

export const MATERIALS: Record<MaterialId, MaterialConfig> = {
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

/** Fixed programming / CAM setup fee (¥) per job. */
export const PROGRAMMING_FEE_CNY = 150;

/** Stock oversize factor on bounding-box volume. */
export const STOCK_FACTOR = 1.15;

/** Safety / inefficiency factor on cut time. */
export const CUT_TIME_SAFETY = 1.2;

/** Min machine billable hours. */
export const MIN_MACHINE_HOURS = 0.25;

/** Lead time: base days + days per machine-hour batch. */
export const LEAD_BASE_DAYS = 3;
export const LEAD_HOURS_PER_DAY = 6;

/** Quote confidence band (±%). Rough geometry heuristic → moderate confidence. */
export const CONFIDENCE_PCT = 70;
