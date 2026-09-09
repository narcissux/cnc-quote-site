import { describe, expect, it } from "vitest";
import { bboxVolumeMm3, computeQuote, estimateCutTimeMin, materialCostPerPiece } from "./engine";
import { CUT_TIME_SAFETY, DEFAULT_QUOTE_CONFIG, MATERIALS, STOCK_FACTOR, cloneDefaultQuoteConfig } from "./config";
import type { GeometryMetrics, QuoteInput } from "./types";

const cube10: GeometryMetrics = {
  lengthMm: 10,
  widthMm: 10,
  heightMm: 10,
  volumeMm3: 1000,
  surfaceAreaMm2: 600,
  triangleCount: 12,
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

describe("estimateCutTimeMin", () => {
  it("follows removed / MRR × factors", () => {
    const input = baseInput();
    const bbox = 1000;
    const stock = bbox * STOCK_FACTOR;
    const removedMm3 = stock - 1000;
    const removedCm3 = removedMm3 / 1000;
    const expected =
      (removedCm3 / MATERIALS.Al6061.mrrCm3PerMin) *
      1.0 *
      CUT_TIME_SAFETY *
      1.0;
    expect(estimateCutTimeMin(input)).toBeCloseTo(expected, 6);
  });

  it("applies precision tolerance factor", () => {
    const std = estimateCutTimeMin(baseInput({ tolerance: "standard" }));
    const prec = estimateCutTimeMin(baseInput({ tolerance: "precision" }));
    expect(prec / std).toBeCloseTo(1.35, 5);
  });

  it("never negative when part fills stock", () => {
    const solid: GeometryMetrics = {
      ...cube10,
      volumeMm3: 1000 * STOCK_FACTOR + 100,
    };
    const t = estimateCutTimeMin(baseInput({ geometry: solid }));
    expect(t).toBe(0);
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

describe("computeQuote hourly", () => {
  it("sums five lines to total", () => {
    const q = computeQuote(baseInput({ quantity: 2, mode: "hourly" }));
    expect(q.currency).toBe("CNY");
    expect(q.mode).toBe("hourly");
    expect(q.leadTier).toBe("standard");
    expect(q.totalPriceCny).toBeGreaterThan(0);
    expect(q.unitPriceCny).toBeCloseTo(q.totalPriceCny / 2, 2);
    expect(q.lines.length).toBe(5);
    expect(q.lines.map((l) => l.id).sort()).toEqual(
      ["finish", "lead", "machine", "material", "programming"].sort(),
    );
    const sum = q.lines.reduce((s, l) => s + l.amountCny, 0);
    expect(sum).toBeCloseTo(q.totalPriceCny, 1);
    expect(q.leadTimeDays).toBeGreaterThanOrEqual(1);
    expect(q.confidencePct).toBe(DEFAULT_QUOTE_CONFIG.confidencePct);
    expect(q.notes.length).toBeGreaterThan(0);
  });

  it("5-axis costs more than 3-axis", () => {
    const a3 = computeQuote(baseInput({ machine: "3axis" }));
    const a5 = computeQuote(baseInput({ machine: "5axis" }));
    expect(a5.totalPriceCny).toBeGreaterThan(a3.totalPriceCny);
  });
});

describe("computeQuote per_piece", () => {
  it("amortizes programming into unit price", () => {
    const q1 = computeQuote(baseInput({ quantity: 1, mode: "per_piece" }));
    const q10 = computeQuote(baseInput({ quantity: 10, mode: "per_piece" }));
    expect(q10.unitPriceCny).toBeLessThan(q1.unitPriceCny);
    expect(q10.totalPriceCny).toBeCloseTo(q10.unitPriceCny * 10, 1);
    expect(q10.lines.length).toBe(5);
  });

  it("clamps quantity to 1–1000", () => {
    const q0 = computeQuote(baseInput({ quantity: 0, mode: "per_piece" }));
    const qHuge = computeQuote(baseInput({ quantity: 99999, mode: "per_piece" }));
    expect(q0.totalPriceCny).toBeGreaterThan(0);
    expect(qHuge.unitPriceCny * 1000).toBeCloseTo(qHuge.totalPriceCny, -1);
  });
});

describe("tolerance pricing monotonicity", () => {
  it("precision unit/total price strictly greater than standard on tiny parts", () => {
    const std = computeQuote(baseInput({ tolerance: "standard", mode: "hourly" }));
    const prec = computeQuote(baseInput({ tolerance: "precision", mode: "hourly" }));
    expect(prec.machineHours).toBeGreaterThan(std.machineHours);
    expect(prec.unitPriceCny).toBeGreaterThan(std.unitPriceCny);
    expect(prec.totalPriceCny).toBeGreaterThan(std.totalPriceCny);
  });

  it("precision unit/total price strictly greater in per_piece mode too", () => {
    const std = computeQuote(baseInput({ tolerance: "standard", mode: "per_piece" }));
    const prec = computeQuote(baseInput({ tolerance: "precision", mode: "per_piece" }));
    expect(prec.unitPriceCny).toBeGreaterThan(std.unitPriceCny);
    expect(prec.totalPriceCny).toBeGreaterThan(std.totalPriceCny);
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
