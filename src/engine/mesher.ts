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
 * Greedy meshing directly from a flat grid (Uint8Array) + palette.
 * grid[x + y*S + z*S*S] = palette index (0 = air).
 * Much faster than VoxelData[] version — zero allocations for intermediate objects.
 */
export function greedyMeshGrid(
  grid: Uint8Array,
  palette: string[],
  S = 32,
): MergedFace[] {
  const result: MergedFace[] = [];
  const S2 = S * S;

  function idx(x: number, y: number, z: number): number {
    return x + y * S + z * S2;
  }

  function solid(x: number, y: number, z: number): boolean {
    if (x < 0 || x >= S || y < 0 || y >= S || z < 0 || z >= S) return false;
    return grid[idx(x, y, z)] !== 0;
  }

  function getColor(x: number, y: number, z: number): number {
    if (x < 0 || x >= S || y < 0 || y >= S || z < 0 || z >= S) return 0;
    return grid[idx(x, y, z)];
  }

  const mask = new Int32Array(S * S);

  for (const cfg of CONFIGS) {
    for (let a = 0; a < S; a++) {
      mask.fill(0);

      for (let vi = 0; vi < S; vi++) {
        for (let ui = 0; ui < S; ui++) {
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

          mask[vi * S + ui] = ci;
        }
      }

      for (let vi = 0; vi < S; vi++) {
        for (let ui = 0; ui < S;) {
          const ci = mask[vi * S + ui];
          if (ci === 0) { ui++; continue; }

          let w = 1;
          while (ui + w < S && mask[vi * S + ui + w] === ci) w++;

          let h = 1;
          let done = false;
          while (vi + h < S && !done) {
            for (let k = 0; k < w; k++) {
              if (mask[(vi + h) * S + ui + k] !== ci) { done = true; break; }
            }
            if (!done) h++;
          }

          for (let dv = 0; dv < h; dv++)
            for (let du = 0; du < w; du++)
              mask[(vi + dv) * S + ui + du] = 0;

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
