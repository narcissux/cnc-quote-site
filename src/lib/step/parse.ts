/**
 * Server-side STEP (.step / .stp) parser via occt-import-js (OpenCASCADE WASM).
 * Tessellates BREP → triangle mesh, then computes GeometryMetrics (mm).
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { computeMetrics } from "@/lib/stl/parse";
import type { GeometryMetrics } from "@/lib/quote/types";
import { enrichMetrics, type BrepFaceRange } from "@/lib/quote/features";

export const STEP_EMPTY_OR_INVALID_MSG = "STEP 文件为空或无法解析（无有效实体）";
export const STEP_UNSUPPORTED_MSG = "请上传 .step 或 .stp 文件";

export class StepParseError extends Error {
  constructor(message: string = STEP_EMPTY_OR_INVALID_MSG) {
    super(message);
    this.name = "StepParseError";
  }
}

export interface ParsedStep {
  metrics: GeometryMetrics;
  /** Flat xyz triplets for Three.js BufferGeometry (non-indexed). */
  positions: Float32Array;
  normals: Float32Array;
  /** Binary STL bytes (same mesh) for optional client reuse. */
  stlBuffer: ArrayBuffer;
}

type OcctMesh = {
  attributes?: {
    position?: { array?: number[] };
    normal?: { array?: number[] };
  };
  index?: { array?: number[] };
  brep_faces?: Array<{ first?: number; last?: number }>;
};

type OcctResult = {
  success?: boolean;
  meshes?: OcctMesh[];
};

type OcctModule = {
  ReadStepFile: (
    content: Uint8Array,
    params: Record<string, unknown> | null
  ) => OcctResult;
};

let occtPromise: Promise<OcctModule> | null = null;

/**
 * Resolve OCCT WASM via filesystem paths only.
 * Do NOT use require.resolve("occt-import-js"): Next/webpack rewrites that
 * to a numeric module id, so path.dirname(...) becomes "." and locateFile
 * opens a bare "occt-import-js.wasm" (ENOENT under the API route).
 */
function resolveOcctAsset(file: string): string {
  const cwd = process.cwd();
  const serverDir = path.dirname(process.argv[1] || cwd);
  const candidates = [
    // Copied by scripts/copy-occt-wasm.mjs (prebuild / pretest)
    path.join(cwd, "public", file),
    path.join(cwd, "node_modules", "occt-import-js", "dist", file),
    // Docker standalone: cwd is /app with node_modules next to server.js
    path.join(serverDir, "node_modules", "occt-import-js", "dist", file),
    path.join(serverDir, "public", file),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

function loadOcct(): Promise<OcctModule> {
  if (!occtPromise) {
    // createRequire(__filename) -> external require (serverExternalPackages).
    // Avoid dynamic createRequire args (webpack emits void 0).
    const nodeRequire = createRequire(__filename);
    const factory = nodeRequire("occt-import-js") as (
      options?: { locateFile?: (file: string) => string }
    ) => Promise<OcctModule>;
    occtPromise = factory({
      locateFile: (file: string) => resolveOcctAsset(file),
    });
  }
  return occtPromise;
}

function expandMeshes(meshes: OcctMesh[]): {
  positions: Float32Array;
  normals: Float32Array;
  triangleCount: number;
  brepFaces: BrepFaceRange[];
} {
  let triCount = 0;
  for (const m of meshes) {
    const idx = m.index?.array;
    if (idx && idx.length >= 3) {
      triCount += Math.floor(idx.length / 3);
    } else {
      const pos = m.attributes?.position?.array;
      if (pos && pos.length >= 9) triCount += Math.floor(pos.length / 9);
    }
  }
  if (triCount === 0) {
    throw new StepParseError(STEP_EMPTY_OR_INVALID_MSG);
  }

  const positions = new Float32Array(triCount * 9);
  const normals = new Float32Array(triCount * 9);
  const brepFaces: BrepFaceRange[] = [];
  let t = 0;

  for (const m of meshes) {
    const pos = m.attributes?.position?.array;
    if (!pos || pos.length < 9) continue;
    const nrm = m.attributes?.normal?.array;
    const idx = m.index?.array;
    const meshTriStart = t;

    if (idx && idx.length >= 3) {
      for (let i = 0; i + 2 < idx.length; i += 3) {
        const ia = idx[i] * 3;
        const ib = idx[i + 1] * 3;
        const ic = idx[i + 2] * 3;
        const base = t * 9;
        positions[base] = pos[ia];
        positions[base + 1] = pos[ia + 1];
        positions[base + 2] = pos[ia + 2];
        positions[base + 3] = pos[ib];
        positions[base + 4] = pos[ib + 1];
        positions[base + 5] = pos[ib + 2];
        positions[base + 6] = pos[ic];
        positions[base + 7] = pos[ic + 1];
        positions[base + 8] = pos[ic + 2];

        if (nrm && nrm.length >= ia + 3) {
          for (let v = 0; v < 3; v++) {
            const src = [ia, ib, ic][v];
            normals[base + v * 3] = nrm[src];
            normals[base + v * 3 + 1] = nrm[src + 1];
            normals[base + v * 3 + 2] = nrm[src + 2];
          }
        } else {
          const ax = positions[base],
            ay = positions[base + 1],
            az = positions[base + 2];
          const bx = positions[base + 3],
            by = positions[base + 4],
            bz = positions[base + 5];
          const cx = positions[base + 6],
            cy = positions[base + 7],
            cz = positions[base + 8];
          let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
          let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
          let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
          const len = Math.hypot(nx, ny, nz) || 1;
          nx /= len;
          ny /= len;
          nz /= len;
          for (let v = 0; v < 3; v++) {
            normals[base + v * 3] = nx;
            normals[base + v * 3 + 1] = ny;
            normals[base + v * 3 + 2] = nz;
          }
        }
        t++;
      }
    } else {
      const n = Math.floor(pos.length / 9);
      for (let i = 0; i < n; i++) {
        const base = t * 9;
        const src = i * 9;
        positions.set(pos.slice(src, src + 9), base);
        if (nrm && nrm.length >= src + 9) {
          normals.set(nrm.slice(src, src + 9), base);
        }
        t++;
      }
    }

    const localFaces = m.brep_faces;
    if (localFaces && localFaces.length > 0) {
      for (const f of localFaces) {
        if (typeof f.first !== "number" || typeof f.last !== "number") continue;
        brepFaces.push({
          first: meshTriStart + f.first,
          last: meshTriStart + f.last,
        });
      }
    }
  }

  if (t === 0) {
    throw new StepParseError(STEP_EMPTY_OR_INVALID_MSG);
  }

  return {
    positions: t === triCount ? positions : positions.subarray(0, t * 9),
    normals: t === triCount ? normals : normals.subarray(0, t * 9),
    triangleCount: t,
    brepFaces,
  };
}

/** Build a binary STL ArrayBuffer from non-indexed positions + normals. */
export function buildBinaryStl(
  positions: Float32Array,
  normals: Float32Array,
  triangleCount: number
): ArrayBuffer {
  const buffer = new ArrayBuffer(84 + triangleCount * 50);
  const view = new DataView(buffer);
  const header = "cnc-quote-site STEP tessellation";
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0);
  }
  view.setUint32(80, triangleCount, true);
  let offset = 84;
  for (let i = 0; i < triangleCount; i++) {
    const o = i * 9;
    // Use first vertex normal as face normal (STL stores one per facet)
    view.setFloat32(offset, normals[o], true);
    view.setFloat32(offset + 4, normals[o + 1], true);
    view.setFloat32(offset + 8, normals[o + 2], true);
    offset += 12;
    for (let v = 0; v < 3; v++) {
      view.setFloat32(offset, positions[o + v * 3], true);
      view.setFloat32(offset + 4, positions[o + v * 3 + 1], true);
      view.setFloat32(offset + 8, positions[o + v * 3 + 2], true);
      offset += 12;
    }
    view.setUint16(offset, 0, true);
    offset += 2;
  }
  return buffer;
}

export async function parseStepBuffer(buffer: ArrayBuffer): Promise<ParsedStep> {
  if (!buffer || buffer.byteLength === 0) {
    throw new StepParseError(STEP_EMPTY_OR_INVALID_MSG);
  }

  let result: OcctResult;
  try {
    const occt = await loadOcct();
    result = occt.ReadStepFile(new Uint8Array(buffer), {
      linearUnit: "millimeter",
      linearDeflectionType: "bounding_box_ratio",
      linearDeflection: 0.001,
      angularDeflection: 0.5,
    });
  } catch (e) {
    if (e instanceof StepParseError) throw e;
    throw new StepParseError(STEP_EMPTY_OR_INVALID_MSG);
  }

  if (!result?.success || !result.meshes?.length) {
    throw new StepParseError(STEP_EMPTY_OR_INVALID_MSG);
  }

  const { positions, normals, triangleCount, brepFaces } = expandMeshes(
    result.meshes
  );
  const metrics = enrichMetrics(computeMetrics(positions, triangleCount), {
    sourceFormat: "step",
    brepFaces,
    positions,
    normals,
  });
  const stlBuffer = buildBinaryStl(positions, normals, triangleCount);

  return { metrics, positions, normals, stlBuffer };
}

export function isStepFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".step") || lower.endsWith(".stp");
}
