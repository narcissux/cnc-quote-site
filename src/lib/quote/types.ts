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

export interface QuoteInput {
  geometry: GeometryMetrics;
  materialId: MaterialId;
  quantity: number; // 1–1000
  tolerance: ToleranceId;
  finish: FinishId;
  machine: MachineId;
  mode: PricingMode;
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
  confidencePct: number; // e.g. 75 means ±25% band around estimate
  cutTimeMin: number;
  machineHours: number;
  lines: QuoteLine[];
  notes: string[];
}
