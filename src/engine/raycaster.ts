import type { FaceNormal } from './types';

/**
 * DDA ray-voxel intersection. Ray from origin in direction (normalized).
 * Returns first solid voxel hit and the face (normal) we hit.
 */
export function rayIntersectVoxel(
  originX: number,
  originY: number,
  originZ: number,
  dirX: number,
  dirY: number,
  dirZ: number,
  grid: Uint8Array,
  sx: number,
  sy: number,
  sz: number,
): { x: number; y: number; z: number; face: FaceNormal } | null {
  const S2 = sx * sy;
  function idx(x: number, y: number, z: number): number {
    return x + y * sx + z * S2;
  }
  function solid(ix: number, iy: number, iz: number): boolean {
    if (ix < 0 || ix >= sx || iy < 0 || iy >= sy || iz < 0 || iz >= sz) return false;
    return grid[idx(ix, iy, iz)] !== 0;
  }

  let ix = Math.floor(originX);
  let iy = Math.floor(originY);
  let iz = Math.floor(originZ);

  const signX = dirX >= 0 ? 1 : -1;
  const signY = dirY >= 0 ? 1 : -1;
  const signZ = dirZ >= 0 ? 1 : -1;

  const invDx = Math.abs(dirX) < 1e-8 ? Infinity : 1 / Math.abs(dirX);
  const invDy = Math.abs(dirY) < 1e-8 ? Infinity : 1 / Math.abs(dirY);
  const invDz = Math.abs(dirZ) < 1e-8 ? Infinity : 1 / Math.abs(dirZ);

  let tMaxX = (signX > 0 ? ix + 1 - originX : originX - ix) * invDx;
  let tMaxY = (signY > 0 ? iy + 1 - originY : originY - iy) * invDy;
  let tMaxZ = (signZ > 0 ? iz + 1 - originZ : originZ - iz) * invDz;

  const tDeltaX = invDx;
  const tDeltaY = invDy;
  const tDeltaZ = invDz;

  const maxT = (sx + sy + sz) * 2;
  let t = 0;

  while (t < maxT) {
    if (ix >= 0 && ix < sx && iy >= 0 && iy < sy && iz >= 0 && iz < sz && solid(ix, iy, iz)) {
      let face: FaceNormal = 'front';
      if (tMaxX <= tMaxY && tMaxX <= tMaxZ) face = signX > 0 ? 'right' : 'left';
      else if (tMaxY <= tMaxZ) face = signY > 0 ? 'top' : 'bottom';
      else face = signZ > 0 ? 'front' : 'back';
      return { x: ix, y: iy, z: iz, face };
    }

    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
      ix += signX;
      t = tMaxX;
      tMaxX += tDeltaX;
    } else if (tMaxY <= tMaxZ) {
      iy += signY;
      t = tMaxY;
      tMaxY += tDeltaY;
    } else {
      iz += signZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
    }
  }
  return null;
}
