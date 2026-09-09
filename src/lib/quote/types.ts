/** Geometry metrics extracted from STL/STEP (units: mm / mm³ / mm²). */
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
  /** BREP face count (STEP); mesh-proxy may omit */
  faceCount?: number;
  /** Lightweight cylinder proxy count */
  cylinderCount?: number;
  /** Lightweight cone proxy count */
  coneCount?: number;
  /** volume / bboxVolume */
  fillRatio?: number;
  /** Upload / parse source */
  sourceFormat?: "stl" | "step";
  /** Feature-proxy confidence */
  featureConfidence?: "high" | "medium" | "low";
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

export interface TimeBreakdown {
  roughMin: number;
  finishMin: number;
  clampMin: number;
  inspectMin: number;
  /** Sum of the four above (pre tol / pre min-run floor) */
  runMinRaw: number;
  runHoursPerPc: number;
  complexityFactor: number;
  fillRatio: number;
}

export interface QuoteResult {
  mode: PricingMode;
  currency: "CNY";
  unitPriceCny: number;
  totalPriceCny: number;
  leadTimeDays: number;
  leadTier: LeadTierId;
  confidencePct: number; // e.g. 75 means ±25% band around estimate
  /** @deprecated 易误导；保留为 rough+finish 之和，请优先用分项 */
  cutTimeMin: number;
  /** 计费机时合计 = runHoursPerPc × qty */
  machineHours: number;
  billableHours: number;
  roughMin: number;
  finishMin: number;
  clampMin: number;
  inspectMin: number;
  runHoursPerPc: number;
  setupOrProgrammingCny: number;
  complexityFactor: number;
  fillRatio: number;
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
  /** Multiplier on (material+machine+programming+finish[+minOrder]) base; 1 = no surcharge */
  priceFactor: number;
  /** Days added to computed lead (negative = faster) */
  daysOffset: number;
}

/** Complexity proxy weights / refs (admin-tunable). */
export interface ComplexityConfig {
  /** Multiply onto T_finish, or add feature minutes */
  applyTo: "finish" | "feature";
  fillRatioRef: number;
  fillRatioWeight: number;
  triangleRef: number;
  triangleWeight: number;
  cylinderConeRef: number;
  cylinderConeWeight: number;
  minFactor: number;
  maxFactor: number;
  /** Extra minutes when applyTo=feature: base × (factor-1) */
  featureMinutesBase: number;
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
  /** per_piece 模式：一次性编程/开档费 ¥ */
  programmingFeeCny: number;
  /** hourly 模式：一次性编程工时（分钟），× 台时费率 */
  programmingMinutes: number;
  stockFactor: number;
  /** 仅乘在开粗 T_rough 上 */
  cutTimeSafety: number;
  /** 精修进给 mm/min */
  finishFeedMmPerMin: number;
  /** 精修行距 mm */
  stepoverMm: number;
  /** 每件装夹基准分钟 */
  clampMinutesPerPc: number;
  clampFactor: number;
  inspectMinutesStandard: number;
  inspectMinutesPrecision: number;
  /** 只托每件切削相关机时（托底后分项仍可见） */
  minRunHoursPerPc: number;
  /** 整单起步价（不足则补差一行）；0=关闭 */
  minOrderFeeCny: number;
  leadBaseDays: number;
  leadHoursPerDay: number;
  confidencePct: number;
  leadTiers: Record<LeadTierId, LeadTierConfig>;
  complexity: ComplexityConfig;
}
