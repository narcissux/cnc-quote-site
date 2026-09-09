/**
 * Client-side STL parser (binary + ASCII).
 * Computes bbox (mm), volume (mm³), surface area (mm²), triangle count.
 * Assumes STL units are millimeters (industry default for CNC uploads).
 */

import type { GeometryMetrics } from "@/lib/quote/types";
import { enrichMetrics } from "@/lib/quote/features";

export interface ParsedStl {
  metrics: GeometryMetrics;
  /** Flat xyz triplets for Three.js BufferGeometry (non-indexed). */
  positions: Float32Array;
  normals: Float32Array;
}

/** User-facing Chinese message for empty / unparseable STL. */
export const STL_EMPTY_OR_INVALID_MSG = "文件为空或无法解析（无有效网格）";

export class StlParseError extends Error {
  constructor(message: string = STL_EMPTY_OR_INVALID_MSG) {
    super(message);
    this.name = "StlParseError";
  }
}

function isAsciiStl(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  // Binary STL: 80-byte header + uint32 tri count + 50*n bytes
  if (buffer.byteLength < 84) {
    const head = new TextDecoder().decode(bytes.slice(0, Math.min(5, bytes.length)));
    return head.toLowerCase().startsWith("solid");
  }
  const triCount = new DataView(buffer).getUint32(80, true);
  const expected = 84 + triCount * 50;
  if (expected === buffer.byteLength) return false;
  // Heuristic: look for "solid" without matching binary size
  const head = new TextDecoder().decode(bytes.slice(0, Math.min(80, bytes.length)));
  return head.trimStart().toLowerCase().startsWith("solid") && expected !== buffer.byteLength;
}

function parseBinary(buffer: ArrayBuffer): { positions: Float32Array; normals: Float32Array; n: number } {
  if (buffer.byteLength < 84) {
    throw new StlParseError(STL_EMPTY_OR_INVALID_MSG);
  }
  const view = new DataView(buffer);
  const n = view.getUint32(80, true);
  if (!Number.isFinite(n) || n < 0) {
    throw new StlParseError(STL_EMPTY_OR_INVALID_MSG);
  }
  if (n === 0) {
    throw new StlParseError(STL_EMPTY_OR_INVALID_MSG);
  }
  const needed = 84 + n * 50;
  if (buffer.byteLength < needed) {
    // Declared triangle count exceeds file size → empty/corrupt
    throw new StlParseError(STL_EMPTY_OR_INVALID_MSG);
  }

  const positions = new Float32Array(n * 9);
  const normals = new Float32Array(n * 9);
  let offset = 84;
  for (let i = 0; i < n; i++) {
    const nx = view.getFloat32(offset, true);
    const ny = view.getFloat32(offset + 4, true);
    const nz = view.getFloat32(offset + 8, true);
    offset += 12;
    for (let v = 0; v < 3; v++) {
      const base = i * 9 + v * 3;
      positions[base] = view.getFloat32(offset, true);
      positions[base + 1] = view.getFloat32(offset + 4, true);
      positions[base + 2] = view.getFloat32(offset + 8, true);
      normals[base] = nx;
      normals[base + 1] = ny;
      normals[base + 2] = nz;
      offset += 12;
    }
    offset += 2; // attribute byte count
  }
  return { positions, normals, n };
}

function parseAscii(text: string): { positions: Float32Array; normals: Float32Array; n: number } {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new StlParseError(STL_EMPTY_OR_INVALID_MSG);
  }
  const facets = text.split(/facet\s+normal/i).slice(1);
  const n = facets.length;
  if (n === 0) {
    throw new StlParseError(STL_EMPTY_OR_INVALID_MSG);
  }
  const positions = new Float32Array(n * 9);
  const normals = new Float32Array(n * 9);
  const floatRe = /[-+]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)?/g;

  let filled = 0;
  for (let i = 0; i < n; i++) {
    const chunk = facets[i];
    floatRe.lastIndex = 0;
    const nums: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = floatRe.exec(chunk)) !== null) {
      nums.push(parseFloat(m[0]));
      if (nums.length >= 12) break; // nx ny nz + 3*xyz
    }
    if (nums.length < 12) continue;
    const nx = nums[0], ny = nums[1], nz = nums[2];
    for (let v = 0; v < 3; v++) {
      const base = filled * 9 + v * 3;
      positions[base] = nums[3 + v * 3];
      positions[base + 1] = nums[4 + v * 3];
      positions[base + 2] = nums[5 + v * 3];
      normals[base] = nx;
      normals[base + 1] = ny;
      normals[base + 2] = nz;
    }
    filled++;
  }
  if (filled === 0) {
    throw new StlParseError(STL_EMPTY_OR_INVALID_MSG);
  }
  return {
    positions: positions.subarray(0, filled * 9),
    normals: normals.subarray(0, filled * 9),
    n: filled,
  };
}

/** Signed volume contribution of a triangle (origin-based). */
function triSignedVolume(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): number {
  return (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
}

function triArea(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): number {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const cxp = aby * acz - abz * acy;
  const cyp = abz * acx - abx * acz;
  const czp = abx * acy - aby * acx;
  return 0.5 * Math.sqrt(cxp * cxp + cyp * cyp + czp * czp);
}

export function computeMetrics(positions: Float32Array, triangleCount: number): GeometryMetrics {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let volume = 0;
  let area = 0;

  for (let i = 0; i < triangleCount; i++) {
    const o = i * 9;
    const ax = positions[o], ay = positions[o + 1], az = positions[o + 2];
    const bx = positions[o + 3], by = positions[o + 4], bz = positions[o + 5];
    const cx = positions[o + 6], cy = positions[o + 7], cz = positions[o + 8];

    for (const x of [ax, bx, cx]) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    for (const y of [ay, by, cy]) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (const z of [az, bz, cz]) {
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    volume += triSignedVolume(ax, ay, az, bx, by, bz, cx, cy, cz);
    area += triArea(ax, ay, az, bx, by, bz, cx, cy, cz);
  }

  return {
    lengthMm: maxX - minX,
    widthMm: maxY - minY,
    heightMm: maxZ - minZ,
    volumeMm3: Math.abs(volume),
    surfaceAreaMm2: area,
    triangleCount,
  };
}

export async function parseStlFile(file: File): Promise<ParsedStl> {
  if (!file || file.size === 0) {
    throw new StlParseError(STL_EMPTY_OR_INVALID_MSG);
  }
  const buffer = await file.arrayBuffer();
  return parseStlBuffer(buffer);
}

export function parseStlBuffer(buffer: ArrayBuffer): ParsedStl {
  if (!buffer || buffer.byteLength === 0) {
    throw new StlParseError(STL_EMPTY_OR_INVALID_MSG);
  }

  let positions: Float32Array;
  let normals: Float32Array;
  let n: number;

  try {
    if (isAsciiStl(buffer)) {
      const text = new TextDecoder().decode(buffer);
      ({ positions, normals, n } = parseAscii(text));
    } else {
      ({ positions, normals, n } = parseBinary(buffer));
    }
  } catch (e) {
    if (e instanceof StlParseError) throw e;
    // DataView RangeError / other low-level parse failures → friendly message
    throw new StlParseError(STL_EMPTY_OR_INVALID_MSG);
  }

  if (n === 0 || positions.length === 0) {
    throw new StlParseError(STL_EMPTY_OR_INVALID_MSG);
  }

  const metrics = enrichMetrics(computeMetrics(positions, n), {
    sourceFormat: "stl",
  });
  return { metrics, positions, normals };
}
