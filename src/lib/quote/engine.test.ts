import { describe, expect, it } from "vitest";
import {
  bboxVolumeMm3,
  computeComplexityFactor,
  computeQuote,
  estimateCutTimeMin,
  estimateRoughMin,
  estimateTimeBreakdown,
  materialCostPerPiece,
} from "./engine";
import {
  CUT_TIME_SAFETY,
  DEFAULT_QUOTE_CONFIG,
  MATERIALS,
  STOCK_FACTOR,
  cloneDefaultQuoteConfig,
} from "./config";
import type { GeometryMetrics, QuoteInput } from "./types";
import rearAxle from "../../../fixtures/rear-axle-metrics.json";

const cube10: GeometryMetrics = {
  lengthMm: 10,
  widthMm: 10,
  heightMm: 10,
  volumeMm3: 1000,
  surfaceAreaMm2: 600,
  triangleCount: 12,
  fillRatio: 1,
  sourceFormat: "stl",
  featureConfidence: "low",
};

/** Approx ALU.RRT.DRA.002 — constructed metrics (inquiry 5fd0babc not in repo). */
const aluRrtDra002: GeometryMetrics = {
  lengthMm: 70,
  widthMm: 22,
  heightMm: 22,
  volumeMm3: 15985,
  surfaceAreaMm2: 9020,
  triangleCount: 4200,
  fillRatio: 15985 / (70 * 22 * 22),
  faceCount: 28,
  cylinderCount: 3,
  coneCount: 0,
  sourceFormat: "step",
  featureConfidence: "medium",
};

function baseInput(over: Partial<QuoteInput> = {}): QuoteInput {
  return {
    geometry: cube10,
    materialId: "Al6061",
    quantity: 1,
    tolerance: "standard",
    finish: "as_machined",
    machine: "3axis",
    mode: "hourly",
    leadTier: "standard",
    ...over,
  };
}

describe("bboxVolumeMm3", () => {
  it("multiplies L×W×H", () => {
    expect(bboxVolumeMm3(cube10)).toBe(1000);
  });
});

describe("estimateRoughMin", () => {
  it("is removed/MRR × safety only (no finishFactor / tol)", () => {
    const input = baseInput({ finish: "anodize", tolerance: "precision" });
    const bbox = 1000;
    const stock = bbox * STOCK_FACTOR;
    const removedCm3 = (stock - 1000) / 1000;
    const expected = (removedCm3 / MATERIALS.Al6061.mrrCm3PerMin) * CUT_TIME_SAFETY;
    expect(estimateRoughMin(input)).toBeCloseTo(expected, 6);
  });

  it("never negative when part fills stock", () => {
    const solid: GeometryMetrics = {
      ...cube10,
      volumeMm3: 1000 * STOCK_FACTOR + 100,
    };
    expect(estimateRoughMin(baseInput({ geometry: solid }))).toBe(0);
  });
});

describe("estimateCutTimeMin (legacy alias)", () => {
  it("returns rough+finish scaled by tol when includeTolerance", () => {
    const std = estimateCutTimeMin(baseInput({ tolerance: "standard" }), true);
    const prec = estimateCutTimeMin(baseInput({ tolerance: "precision" }), true);
    expect(prec / std).toBeCloseTo(1.35, 5);
  });
});

describe("materialCostPerPiece", () => {
  it("uses stock mass × ¥/kg", () => {
    const cost = materialCostPerPiece(baseInput());
    const stockCm3 = (1000 * STOCK_FACTOR) / 1000;
    const massKg = (stockCm3 * MATERIALS.Al6061.densityGPerCm3) / 1000;
    expect(cost).toBeCloseTo(massKg * MATERIALS.Al6061.pricePerKg, 6);
  });

  it("respects runtime config pricePerKg", () => {
    const cfg = cloneDefaultQuoteConfig();
    cfg.materials.Al6061.pricePerKg = 100;
    const cost = materialCostPerPiece(baseInput(), cfg);
    const stockCm3 = (1000 * STOCK_FACTOR) / 1000;
    const massKg = (stockCm3 * MATERIALS.Al6061.densityGPerCm3) / 1000;
    expect(cost).toBeCloseTo(massKg * 100, 6);
  });
});

describe("time breakdown P0", () => {
  it("exposes rough/finish/clamp/inspect and is not ≈0.25×tol floor", () => {
    const tb = estimateTimeBreakdown(
      baseInput({
        geometry: aluRrtDra002,
        tolerance: "precision",
        finish: "anodize",
      }),
    );
    expect(tb.roughMin).toBeGreaterThan(0);
    expect(tb.finishMin).toBeGreaterThan(0);
    expect(tb.clampMin).toBeGreaterThanOrEqual(8);
    expect(tb.inspectMin).toBe(DEFAULT_QUOTE_CONFIG.inspectMinutesPrecision);
    expect(tb.runHoursPerPc).toBeGreaterThan(0.25 * 1.35 * 0.9);
    // Components still visible (not swallowed)
    expect(tb.roughMin + tb.finishMin + tb.clampMin + tb.inspectMin).toBeCloseTo(
      tb.runMinRaw,
      6,
    );
  });

  it("complexity rises with low fill / many tris", () => {
    const simple = computeComplexityFactor(cube10);
    const complex = computeComplexityFactor(aluRrtDra002);
    expect(complex).toBeGreaterThan(simple);
  });
});

describe("computeQuote hourly", () => {
  it("sums lines to total and exposes billable fields", () => {
    const q = computeQuote(baseInput({ quantity: 2, mode: "hourly" }));
    expect(q.currency).toBe("CNY");
    expect(q.mode).toBe("hourly");
    expect(q.leadTier).toBe("standard");
    expect(q.totalPriceCny).toBeGreaterThan(0);
    expect(q.unitPriceCny).toBeCloseTo(q.totalPriceCny / 2, 2);
    expect(q.billableHours).toBe(q.machineHours);
    expect(q.roughMin).toBeGreaterThanOrEqual(0);
    expect(q.clampMin).toBeGreaterThan(0);
    const sum = q.lines.reduce((s, l) => s + l.amountCny, 0);
    expect(sum).toBeCloseTo(q.totalPriceCny, 1);
    expect(q.notes.length).toBeGreaterThan(0);
    expect(q.lines.some((l) => l.id === "machine")).toBe(true);
  });

  it("5-axis costs more than 3-axis", () => {
    const a3 = computeQuote(baseInput({ machine: "3axis" }));
    const a5 = computeQuote(baseInput({ machine: "5axis" }));
    expect(a5.totalPriceCny).toBeGreaterThan(a3.totalPriceCny);
  });
});

describe("machine hours display vs amount", () => {
  it("billableHours × rate equals machine line amount (same round baseline)", () => {
    const q = computeQuote(
      baseInput({
        geometry: aluRrtDra002,
        materialId: "Al6061",
        quantity: 1,
        tolerance: "precision",
        finish: "anodize",
        machine: "3axis",
        mode: "per_piece",
      }),
    );
    const machine = q.lines.find((l) => l.id === "machine")!;
    const rate =
      DEFAULT_QUOTE_CONFIG.materials.Al6061.hourlyRateCny *
      DEFAULT_QUOTE_CONFIG.machineRateMultiplier["3axis"];
    // Display hours × rate must match line amount (within 0.01 after shared round2).
    const fromDisplay = Math.round(q.billableHours * rate * 100) / 100;
    expect(fromDisplay).toBe(machine.amountCny);
    expect(q.machineHours).toBe(q.billableHours);
    expect(Math.abs(q.billableHours * rate - machine.amountCny)).toBeLessThanOrEqual(0.01);
  });

  it("holds for qty>1 hourly too", () => {
    const q = computeQuote(
      baseInput({
        geometry: aluRrtDra002,
        materialId: "Al6061",
        quantity: 3,
        tolerance: "precision",
        finish: "anodize",
        machine: "3axis",
        mode: "hourly",
      }),
    );
    const machine = q.lines.find((l) => l.id === "machine")!;
    const rate =
      DEFAULT_QUOTE_CONFIG.materials.Al6061.hourlyRateCny *
      DEFAULT_QUOTE_CONFIG.machineRateMultiplier["3axis"];
    const fromDisplay = Math.round(q.billableHours * rate * 100) / 100;
    expect(fromDisplay).toBe(machine.amountCny);
  });
});

describe("computeQuote per_piece", () => {
  it("amortizes programming into unit price (qty1 > qty10)", () => {
    const q1 = computeQuote(
      baseInput({ quantity: 1, mode: "per_piece", geometry: aluRrtDra002 }),
    );
    const q10 = computeQuote(
      baseInput({ quantity: 10, mode: "per_piece", geometry: aluRrtDra002 }),
    );
    expect(q10.unitPriceCny).toBeLessThan(q1.unitPriceCny);
    expect(q10.totalPriceCny).toBeCloseTo(q10.unitPriceCny * 10, 1);
  });

  it("clamps quantity to 1–1000", () => {
    const q0 = computeQuote(baseInput({ quantity: 0, mode: "per_piece" }));
    const qHuge = computeQuote(baseInput({ quantity: 99999, mode: "per_piece" }));
    expect(q0.totalPriceCny).toBeGreaterThan(0);
    expect(qHuge.unitPriceCny * 1000).toBeCloseTo(qHuge.totalPriceCny, -1);
  });
});

describe("mode fork", () => {
  it("hourly vs per_piece totals differ at qty>1", () => {
    const h = computeQuote(
      baseInput({ quantity: 10, mode: "hourly", geometry: aluRrtDra002 }),
    );
    const p = computeQuote(
      baseInput({ quantity: 10, mode: "per_piece", geometry: aluRrtDra002 }),
    );
    expect(h.totalPriceCny).not.toBeCloseTo(p.totalPriceCny, 0);
    expect(h.setupOrProgrammingCny).not.toBeCloseTo(p.setupOrProgrammingCny, 0);
  });
});

describe("tolerance pricing monotonicity", () => {
  it("precision unit/total price strictly greater than standard", () => {
    const std = computeQuote(
      baseInput({ tolerance: "standard", mode: "hourly", geometry: aluRrtDra002 }),
    );
    const prec = computeQuote(
      baseInput({
        tolerance: "precision",
        mode: "hourly",
        geometry: aluRrtDra002,
      }),
    );
    expect(prec.machineHours).toBeGreaterThan(std.machineHours);
    expect(prec.unitPriceCny).toBeGreaterThan(std.unitPriceCny);
    expect(prec.totalPriceCny).toBeGreaterThan(std.totalPriceCny);
  });

  it("precision greater in per_piece mode too", () => {
    const std = computeQuote(
      baseInput({
        tolerance: "standard",
        mode: "per_piece",
        geometry: aluRrtDra002,
      }),
    );
    const prec = computeQuote(
      baseInput({
        tolerance: "precision",
        mode: "per_piece",
        geometry: aluRrtDra002,
      }),
    );
    expect(prec.unitPriceCny).toBeGreaterThan(std.unitPriceCny);
    expect(prec.machineHours).toBeGreaterThan(std.machineHours);
  });
});

describe("lead tiers", () => {
  it("rush > standard > economy on price", () => {
    const rush = computeQuote(baseInput({ leadTier: "rush" }));
    const std = computeQuote(baseInput({ leadTier: "standard" }));
    const eco = computeQuote(baseInput({ leadTier: "economy" }));
    expect(rush.totalPriceCny).toBeGreaterThan(std.totalPriceCny);
    expect(std.totalPriceCny).toBeGreaterThan(eco.totalPriceCny);
    expect(rush.leadTimeDays).toBeLessThan(eco.leadTimeDays);
    const leadLine = (q: ReturnType<typeof computeQuote>) =>
      q.lines.find((l) => l.id === "lead")!.amountCny;
    expect(leadLine(rush)).toBeGreaterThan(0);
    expect(leadLine(std)).toBeCloseTo(0, 5);
    expect(leadLine(eco)).toBeLessThan(0);
  });
});

describe("rear axle fixture", () => {
  it("quotes with visible rough+finish+clamp", () => {
    const g = rearAxle.metrics as GeometryMetrics;
    const q = computeQuote(
      baseInput({
        geometry: { ...g, sourceFormat: "stl", featureConfidence: "low" },
        materialId: "Steel1045",
        quantity: 2,
        mode: "hourly",
      }),
    );
    expect(q.roughMin + q.finishMin).toBeGreaterThan(0);
    expect(q.clampMin).toBeGreaterThan(0);
    expect(q.billableHours).toBeGreaterThan(0.25);
    const sum = q.lines.reduce((s, l) => s + l.amountCny, 0);
    expect(sum).toBeCloseTo(q.totalPriceCny, 1);
  });
});

describe("config override", () => {
  it("admin clampMinutesPerPc changes quote", () => {
    const cfg = cloneDefaultQuoteConfig();
    cfg.clampMinutesPerPc = 20;
    const a = computeQuote(baseInput({ geometry: aluRrtDra002 }));
    const b = computeQuote(baseInput({ geometry: aluRrtDra002 }), cfg);
    expect(b.clampMin).toBeGreaterThan(a.clampMin);
    expect(b.totalPriceCny).toBeGreaterThan(a.totalPriceCny);
  });
});
