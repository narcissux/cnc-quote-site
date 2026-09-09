import { promises as fs } from "fs";
import path from "path";
import { cloneDefaultQuoteConfig, DEFAULT_QUOTE_CONFIG } from "./config";
import type {
  FinishId,
  LeadTierId,
  MachineId,
  MaterialId,
  QuoteConfig,
  ToleranceId,
} from "./types";

const CONFIG_REL = path.join("data", "quote-config.json");

export function getDataDir(): string {
  return path.join(process.cwd(), "data");
}

export function getConfigPath(): string {
  return path.join(process.cwd(), CONFIG_REL);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mergeConfig(raw: unknown): QuoteConfig {
  const base = cloneDefaultQuoteConfig();
  if (!isObj(raw)) return base;

  if (isObj(raw.materials)) {
    for (const id of Object.keys(base.materials) as MaterialId[]) {
      const m = raw.materials[id];
      if (!isObj(m)) continue;
      const cur = base.materials[id];
      base.materials[id] = {
        id,
        labelZh: typeof m.labelZh === "string" ? m.labelZh : cur.labelZh,
        densityGPerCm3:
          typeof m.densityGPerCm3 === "number" ? m.densityGPerCm3 : cur.densityGPerCm3,
        pricePerKg: typeof m.pricePerKg === "number" ? m.pricePerKg : cur.pricePerKg,
        mrrCm3PerMin:
          typeof m.mrrCm3PerMin === "number" ? m.mrrCm3PerMin : cur.mrrCm3PerMin,
        hourlyRateCny:
          typeof m.hourlyRateCny === "number" ? m.hourlyRateCny : cur.hourlyRateCny,
      };
    }
  }

  const numMaps: Array<[
    keyof QuoteConfig,
    Record<string, number>,
  ]> = [
    ["toleranceFactor", base.toleranceFactor],
    ["finishFactor", base.finishFactor],
    ["finishSurchargeCny", base.finishSurchargeCny],
    ["machineRateMultiplier", base.machineRateMultiplier],
  ];
  for (const [key, target] of numMaps) {
    const src = raw[key];
    if (!isObj(src)) continue;
    for (const k of Object.keys(target)) {
      if (typeof src[k] === "number") target[k] = src[k] as number;
    }
  }

  const strMaps: Array<[keyof QuoteConfig, Record<string, string>]> = [
    ["toleranceLabel", base.toleranceLabel],
    ["finishLabel", base.finishLabel],
    ["machineLabel", base.machineLabel],
  ];
  for (const [key, target] of strMaps) {
    const src = raw[key];
    if (!isObj(src)) continue;
    for (const k of Object.keys(target)) {
      if (typeof src[k] === "string") target[k] = src[k] as string;
    }
  }

  const scalars: Array<keyof QuoteConfig> = [
    "programmingFeeCny",
    "stockFactor",
    "cutTimeSafety",
    "minMachineHours",
    "leadBaseDays",
    "leadHoursPerDay",
    "confidencePct",
  ];
  for (const key of scalars) {
    if (typeof raw[key] === "number") {
      (base as unknown as Record<string, unknown>)[key] = raw[key];
    }
  }

  if (isObj(raw.leadTiers)) {
    for (const id of Object.keys(base.leadTiers) as LeadTierId[]) {
      const t = raw.leadTiers[id];
      if (!isObj(t)) continue;
      const cur = base.leadTiers[id];
      base.leadTiers[id] = {
        id,
        labelZh: typeof t.labelZh === "string" ? t.labelZh : cur.labelZh,
        priceFactor: typeof t.priceFactor === "number" ? t.priceFactor : cur.priceFactor,
        daysOffset: typeof t.daysOffset === "number" ? t.daysOffset : cur.daysOffset,
      };
    }
  }

  return base;
}

/** Public / quote-facing fields (no secrets). */
export function toPublicQuoteConfig(cfg: QuoteConfig): QuoteConfig {
  return structuredClone(cfg);
}

export async function loadQuoteConfig(): Promise<QuoteConfig> {
  try {
    const text = await fs.readFile(getConfigPath(), "utf8");
    return mergeConfig(JSON.parse(text) as unknown);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") return cloneDefaultQuoteConfig();
    console.error("[quote-config] load failed, using defaults:", e);
    return cloneDefaultQuoteConfig();
  }
}

export async function saveQuoteConfig(cfg: QuoteConfig): Promise<void> {
  const merged = mergeConfig(cfg);
  const dir = getDataDir();
  await fs.mkdir(dir, { recursive: true });
  const tmp = getConfigPath() + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(merged, null, 2), "utf8");
  await fs.rename(tmp, getConfigPath());
}

export function validateQuoteConfigShape(raw: unknown): QuoteConfig {
  return mergeConfig(raw);
}

export { DEFAULT_QUOTE_CONFIG };

export type PublicMaterialId = MaterialId;
export type PublicToleranceId = ToleranceId;
export type PublicFinishId = FinishId;
export type PublicMachineId = MachineId;
export type PublicLeadTierId = LeadTierId;
