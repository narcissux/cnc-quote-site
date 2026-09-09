/** Geometry metrics extracted from an STL (units: mm / mm³ / mm²). */
export interface GeometryMetrics {
  /** Bounding box length (X) in mm */
  lengthMm: number;
  /** Bounding box width (Y) in mm */
  widthMm: number;
  /** Bounding box height (Z) in mm */
  heightMm: number;
  /** Part volume in mm³ */
  volumeMm3: number;
  /** Surface area in mm² */
  surfaceAreaMm2: number;
  /** Triangle count */
  triangleCount: number;
}

export type MaterialId =
  | "Al6061"
  | "Al7075"
  | "Steel1045"
  | "SS304"
  | "BrassC360";

export type ToleranceId = "standard" | "precision";
export type FinishId = "as_machined" | "anodize" | "blast";
export type MachineId = "3axis" | "5axis";
export type PricingMode = "hourly" | "per_piece";
export type LeadTierId = "rush" | "standard" | "economy";

export interface QuoteInput {
  geometry: GeometryMetrics;
  materialId: MaterialId;
  quantity: number; // 1–1000
  tolerance: ToleranceId;
  finish: FinishId;
  machine: MachineId;
  mode: PricingMode;
  /** 交期档位：加急 / 标准 / 经济 */
  leadTier?: LeadTierId;
}

export interface QuoteLine {
  id: string;
  label: string;
  amountCny: number;
  formula: string;
}

export interface QuoteResult {
  mode: PricingMode;
  currency: "CNY";
  unitPriceCny: number;
  totalPriceCny: number;
  leadTimeDays: number;
  leadTier: LeadTierId;
  confidencePct: number; // e.g. 75 means ±25% band around estimate
  cutTimeMin: number;
  machineHours: number;
  lines: QuoteLine[];
  notes: string[];
}

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

export interface LeadTierConfig {
  id: LeadTierId;
  labelZh: string;
  /** Multiplier on (material+machine+programming+finish) base; 1 = no surcharge */
  priceFactor: number;
  /** Days added to computed lead (negative = faster) */
  daysOffset: number;
}

/** Full editable quote configuration (admin + runtime). */
export interface QuoteConfig {
  materials: Record<MaterialId, MaterialConfig>;
  toleranceFactor: Record<ToleranceId, number>;
  toleranceLabel: Record<ToleranceId, string>;
  finishFactor: Record<FinishId, number>;
  finishLabel: Record<FinishId, string>;
  finishSurchargeCny: Record<FinishId, number>;
  machineRateMultiplier: Record<MachineId, number>;
  machineLabel: Record<MachineId, string>;
  programmingFeeCny: number;
  stockFactor: number;
  cutTimeSafety: number;
  minMachineHours: number;
  leadBaseDays: number;
  leadHoursPerDay: number;
  confidencePct: number;
  leadTiers: Record<LeadTierId, LeadTierConfig>;
}
