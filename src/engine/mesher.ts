import type { MergedFace, FaceNormal } from './types';

const CONFIGS: {
  normal: FaceNormal;
  axis: 0 | 1 | 2;
  u: 0 | 1 | 2;
  v: 0 | 1 | 2;
  dir: number;
}[] = [
  { normal: 'top',    axis: 1, u: 0, v: 2, dir: 1 },
  { normal: 'bottom', axis: 1, u: 0, v: 2, dir: -1 },
  { normal: 'right',  axis: 0, u: 2, v: 1, dir: 1 },
  { normal: 'left',   axis: 0, u: 2, v: 1, dir: -1 },
  { normal: 'front',  axis: 2, u: 0, v: 1, dir: 1 },
  { normal: 'back',   axis: 2, u: 0, v: 1, dir: -1 },
];

/**
 * Greedy meshing from a flat grid (Uint8Array) + palette.
 * grid[x + y*sx + z*sx*sy] = palette index (0 = air).
 * sx, sy, sz: dimensions (default cubic 32).
 */
export function greedyMeshGrid(
  grid: Uint8Array,
  palette: string[],
  sx: number,
  sy?: number,
  sz?: number,
): MergedFace[] {
  const Sx = sx;
  const Sy = sy ?? sx;
  const Sz = sz ?? sx;
  const S2 = Sx * Sy;
  const result: MergedFace[] = [];

  const dims = [Sx, Sy, Sz] as const;

  function idx(x: number, y: number, z: number): number {
    return x + y * Sx + z * S2;
  }

  function solid(x: number, y: number, z: number): boolean {
    if (x < 0 || x >= Sx || y < 0 || y >= Sy || z < 0 || z >= Sz) return false;
    return grid[idx(x, y, z)] !== 0;
  }

  function getColor(x: number, y: number, z: number): number {
    if (x < 0 || x >= Sx || y < 0 || y >= Sy || z < 0 || z >= Sz) return 0;
    return grid[idx(x, y, z)];
  }

  const maskSize = Math.max(Sx * Sy, Sx * Sz, Sy * Sz);
  const mask = new Int32Array(maskSize);

  for (const cfg of CONFIGS) {
    const axisLen = dims[cfg.axis];
    for (let a = 0; a < axisLen; a++) {
      mask.fill(0);

      for (let vi = 0; vi < dims[cfg.v]; vi++) {
        for (let ui = 0; ui < dims[cfg.u]; ui++) {
          const coords = [0, 0, 0];
          coords[cfg.axis] = a;
          coords[cfg.u] = ui;
          coords[cfg.v] = vi;

          const ci = getColor(coords[0], coords[1], coords[2]);
          if (ci === 0) continue;

          const nb = [0, 0, 0];
          nb[cfg.axis] = a + cfg.dir;
          nb[cfg.u] = ui;
          nb[cfg.v] = vi;
          if (solid(nb[0], nb[1], nb[2])) continue;

          mask[vi * dims[cfg.u] + ui] = ci;
        }
      }

      const Su = dims[cfg.u];
      const Sv = dims[cfg.v];
      for (let vi = 0; vi < Sv; vi++) {
        for (let ui = 0; ui < Su;) {
          const ci = mask[vi * Su + ui];
          if (ci === 0) { ui++; continue; }

          let w = 1;
          while (ui + w < Su && mask[vi * Su + ui + w] === ci) w++;

          let h = 1;
          let done = false;
          while (vi + h < Sv && !done) {
            for (let k = 0; k < w; k++) {
              if (mask[(vi + h) * Su + ui + k] !== ci) { done = true; break; }
            }
            if (!done) h++;
          }

          for (let dv = 0; dv < h; dv++)
            for (let du = 0; du < w; du++)
              mask[(vi + dv) * Su + ui + du] = 0;

          const coords = [0, 0, 0];
          coords[cfg.axis] = a;
          coords[cfg.u] = ui;
          coords[cfg.v] = vi;

          result.push({
            x: coords[0], y: coords[1], z: coords[2],
            w, h, normal: cfg.normal, color: palette[ci] || '#ff00ff',
          });

          ui += w;
        }
      }
    }
  }

  return result;
}
