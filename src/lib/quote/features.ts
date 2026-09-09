/**
 * Lightweight feature proxy (P0) — not real CAM feature recognition.
 * STEP: BREP face count + per-face normal curvature → cylinder/cone heuristic.
 * STL / mesh fallback: fill ratio + triangle density proxies.
 */

import type { GeometryMetrics } from "./types";

export type BrepFaceRange = { first: number; last: number };

function bboxVolume(g: Pick<GeometryMetrics, "lengthMm" | "widthMm" | "heightMm">): number {
  return g.lengthMm * g.widthMm * g.heightMm;
}

/** Average normal direction variance within a triangle index range (inclusive). */
function faceNormalSpread(
  normals: Float32Array,
  positions: Float32Array,
  triFirst: number,
  triLast: number,
): { spread: number; triCount: number; radialHint: number } {
  const nTris = Math.max(0, triLast - triFirst + 1);
  if (nTris <= 0) return { spread: 0, triCount: 0, radialHint: 0 };

  let sx = 0, sy = 0, sz = 0;
  let cx = 0, cy = 0, cz = 0;
  let samples = 0;
  for (let t = triFirst; t <= triLast; t++) {
    const o = t * 9;
    if (o + 8 >= normals.length) break;
    const nx = normals[o];
    const ny = normals[o + 1];
    const nz = normals[o + 2];
    sx += nx;
    sy += ny;
    sz += nz;
    if (o + 8 < positions.length) {
      cx += (positions[o] + positions[o + 3] + positions[o + 6]) / 3;
      cy += (positions[o + 1] + positions[o + 4] + positions[o + 7]) / 3;
      cz += (positions[o + 2] + positions[o + 5] + positions[o + 8]) / 3;
      samples++;
    }
  }
  const inv = 1 / nTris;
  sx *= inv;
  sy *= inv;
  sz *= inv;
  const meanLen = Math.hypot(sx, sy, sz) || 1e-9;
  // For a plane, mean unit normal ≈ 1; for a cylinder around full 360°, mean ≈ 0.
  const spread = 1 - Math.min(1, meanLen);

  let radialHint = 0;
  if (samples > 0) {
    cx /= samples;
    cy /= samples;
    cz /= samples;
    let dotSum = 0;
    let dotN = 0;
    for (let t = triFirst; t <= triLast; t++) {
      const o = t * 9;
      if (o + 8 >= normals.length || o + 8 >= positions.length) break;
      const mx = (positions[o] + positions[o + 3] + positions[o + 6]) / 3 - cx;
      const my = (positions[o + 1] + positions[o + 4] + positions[o + 7]) / 3 - cy;
      const mz = (positions[o + 2] + positions[o + 5] + positions[o + 8]) / 3 - cz;
      const nx = normals[o];
      const ny = normals[o + 1];
      const nz = normals[o + 2];
      const ml = Math.hypot(mx, my, mz) || 1e-9;
      const nl = Math.hypot(nx, ny, nz) || 1e-9;
      dotSum += Math.abs((mx * nx + my * ny + mz * nz) / (ml * nl));
      dotN++;
    }
    radialHint = dotN > 0 ? dotSum / dotN : 0;
  }

  return { spread, triCount: nTris, radialHint };
}

/**
 * Classify BREP faces: planar vs cylinder-like vs cone-like (heuristic).
 */
export function classifyBrepFaces(
  brepFaces: BrepFaceRange[],
  positions: Float32Array,
  normals: Float32Array,
): { faceCount: number; cylinderCount: number; coneCount: number } {
  let cylinderCount = 0;
  let coneCount = 0;
  for (const f of brepFaces) {
    const { spread, triCount, radialHint } = faceNormalSpread(
      normals,
      positions,
      f.first,
      f.last,
    );
    if (triCount < 2) continue;
    if (spread < 0.12) continue; // mostly planar
    // High radial alignment of normals → cylinder/cone side wall
    if (radialHint > 0.55 && spread > 0.2) {
      // Cones tend to have fewer tris relative to spread; cylinders often denser strips.
      // Use a soft split: very high spread + moderate tris → cone-ish taper region.
      if (spread > 0.55 && triCount < 24) coneCount++;
      else cylinderCount++;
    } else if (spread > 0.35) {
      // Curved but not clearly radial — count as cylinder proxy
      cylinderCount++;
    }
  }
  return {
    faceCount: brepFaces.length,
    cylinderCount,
    coneCount,
  };
}

/** Mesh-only proxy when BREP faces unavailable (STL). */
export function meshFeatureProxy(
  metrics: Pick<
    GeometryMetrics,
    "lengthMm" | "widthMm" | "heightMm" | "volumeMm3" | "triangleCount" | "surfaceAreaMm2"
  >,
): { faceCount: number; cylinderCount: number; coneCount: number } {
  const fill = fillRatioFrom(metrics);
  const bboxSa =
    2 *
    (metrics.lengthMm * metrics.widthMm +
      metrics.lengthMm * metrics.heightMm +
      metrics.widthMm * metrics.heightMm);
  const saRatio = bboxSa > 0 ? metrics.surfaceAreaMm2 / bboxSa : 1;
  // More triangles + lower fill + higher SA → more curved features
  const curvedScore =
    (1 - fill) * 4 + Math.min(3, metrics.triangleCount / 4000) + Math.max(0, saRatio - 1) * 2;
  const cylinderCount = Math.max(0, Math.round(curvedScore));
  const coneCount = fill < 0.35 && metrics.triangleCount > 3000 ? 1 : 0;
  // Face proxy: rough patch estimate
  const faceCount = Math.max(6, Math.round(Math.sqrt(metrics.triangleCount) * 0.8));
  return { faceCount, cylinderCount, coneCount };
}

export function fillRatioFrom(
  g: Pick<GeometryMetrics, "lengthMm" | "widthMm" | "heightMm" | "volumeMm3">,
): number {
  const bv = bboxVolume(g);
  if (bv <= 0) return 1;
  return Math.min(1, Math.max(0, g.volumeMm3 / bv));
}

/** Attach feature proxy fields onto base metrics. */
export function enrichMetrics(
  base: GeometryMetrics,
  opts: {
    sourceFormat: "stl" | "step";
    brepFaces?: BrepFaceRange[];
    positions?: Float32Array;
    normals?: Float32Array;
  },
): GeometryMetrics {
  const fillRatio = fillRatioFrom(base);
  let faceCount: number | undefined;
  let cylinderCount: number | undefined;
  let coneCount: number | undefined;
  let featureConfidence: GeometryMetrics["featureConfidence"];

  if (
    opts.sourceFormat === "step" &&
    opts.brepFaces &&
    opts.brepFaces.length > 0 &&
    opts.positions &&
    opts.normals
  ) {
    const c = classifyBrepFaces(opts.brepFaces, opts.positions, opts.normals);
    faceCount = c.faceCount;
    cylinderCount = c.cylinderCount;
    coneCount = c.coneCount;
    featureConfidence = "medium";
  } else if (opts.sourceFormat === "step") {
    const c = meshFeatureProxy(base);
    faceCount = c.faceCount;
    cylinderCount = c.cylinderCount;
    coneCount = c.coneCount;
    featureConfidence = "medium";
  } else {
    const c = meshFeatureProxy(base);
    faceCount = c.faceCount;
    cylinderCount = c.cylinderCount;
    coneCount = c.coneCount;
    featureConfidence = "low";
  }

  return {
    ...base,
    fillRatio,
    faceCount,
    cylinderCount,
    coneCount,
    sourceFormat: opts.sourceFormat,
    featureConfidence,
  };
}
