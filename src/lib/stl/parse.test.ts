import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseStlBuffer,
  STL_EMPTY_OR_INVALID_MSG,
  StlParseError,
} from "./parse";

const fixtures = resolve(process.cwd(), "fixtures");

function load(name: string): ArrayBuffer {
  const buf = readFileSync(resolve(fixtures, name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe("parseStlBuffer", () => {
  it("parses tiny-cube.stl with 12 triangles", () => {
    const parsed = parseStlBuffer(load("tiny-cube.stl"));
    expect(parsed.metrics.triangleCount).toBe(12);
    expect(parsed.metrics.lengthMm).toBeCloseTo(10, 5);
    expect(parsed.metrics.widthMm).toBeCloseTo(10, 5);
    expect(parsed.metrics.heightMm).toBeCloseTo(10, 5);
    expect(parsed.positions.length).toBe(12 * 9);
  });

  it("maps empty.stl to Chinese empty/unparseable message", () => {
    expect(() => parseStlBuffer(load("empty.stl"))).toThrow(StlParseError);
    try {
      parseStlBuffer(load("empty.stl"));
    } catch (e) {
      expect(e).toBeInstanceOf(StlParseError);
      expect((e as Error).message).toBe(STL_EMPTY_OR_INVALID_MSG);
      expect((e as Error).message).not.toMatch(/DataView|Offset is outside/i);
    }
  });

  it("maps zero-triangle binary STL to Chinese message", () => {
    expect(() => parseStlBuffer(load("zero-tri.stl"))).toThrowError(
      STL_EMPTY_OR_INVALID_MSG
    );
  });

  it("maps oversize triangle-count claim to Chinese message (no DataView leak)", () => {
    try {
      parseStlBuffer(load("oob-claim.stl"));
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(StlParseError);
      expect((e as Error).message).toBe(STL_EMPTY_OR_INVALID_MSG);
      expect(String(e)).not.toMatch(/DataView|Offset is outside/i);
    }
  });

  it("rejects empty ArrayBuffer", () => {
    expect(() => parseStlBuffer(new ArrayBuffer(0))).toThrowError(
      STL_EMPTY_OR_INVALID_MSG
    );
  });
});
