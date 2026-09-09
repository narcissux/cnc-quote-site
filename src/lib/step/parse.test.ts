import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildBinaryStl,
  isStepFilename,
  parseStepBuffer,
  STEP_EMPTY_OR_INVALID_MSG,
  StepParseError,
} from "./parse";
import { parseStlBuffer } from "@/lib/stl/parse";

const fixtures = resolve(process.cwd(), "fixtures");

function load(name: string): ArrayBuffer {
  const buf = readFileSync(resolve(fixtures, name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe("isStepFilename", () => {
  it("accepts .step and .stp", () => {
    expect(isStepFilename("a.STEP")).toBe(true);
    expect(isStepFilename("b.stp")).toBe(true);
    expect(isStepFilename("c.stl")).toBe(false);
  });
});

describe("parseStepBuffer", () => {
  it("parses tiny-cube.stp with bbox ~10mm", async () => {
    const parsed = await parseStepBuffer(load("tiny-cube.stp"));
    expect(parsed.metrics.triangleCount).toBeGreaterThan(0);
    expect(parsed.metrics.lengthMm).toBeCloseTo(10, 0);
    expect(parsed.metrics.widthMm).toBeCloseTo(10, 0);
    expect(parsed.metrics.heightMm).toBeCloseTo(10, 0);
    expect(parsed.metrics.volumeMm3).toBeGreaterThan(500);
    expect(parsed.positions.length).toBe(parsed.metrics.triangleCount * 9);
    expect(parsed.stlBuffer.byteLength).toBe(
      84 + parsed.metrics.triangleCount * 50
    );
  }, 30000);

  it("round-trips mesh through binary STL", async () => {
    const parsed = await parseStepBuffer(load("tiny-cube.stp"));
    const stl = buildBinaryStl(
      parsed.positions,
      parsed.normals,
      parsed.metrics.triangleCount
    );
    const again = parseStlBuffer(stl);
    expect(again.metrics.triangleCount).toBe(parsed.metrics.triangleCount);
    expect(again.metrics.lengthMm).toBeCloseTo(parsed.metrics.lengthMm, 3);
  }, 30000);

  it("rejects empty buffer with Chinese message", async () => {
    await expect(parseStepBuffer(new ArrayBuffer(0))).rejects.toBeInstanceOf(
      StepParseError
    );
    try {
      await parseStepBuffer(new ArrayBuffer(0));
    } catch (e) {
      expect((e as Error).message).toBe(STEP_EMPTY_OR_INVALID_MSG);
    }
  });

  it("rejects garbage bytes with Chinese message", async () => {
    const junk = new TextEncoder().encode("not a step file at all").buffer;
    await expect(parseStepBuffer(junk)).rejects.toThrow(StepParseError);
  }, 30000);
});
