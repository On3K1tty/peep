/**
 * Chunk-ready API: dirty-region tracking for incremental rebuild.
 * No full streaming in this phase — prepares for chunk-based rebuild.
 */

export interface ChunkManager {
  readonly chunkSize: number;
  /** Mark chunk containing (x,y,z) as dirty */
  markDirty(x: number, y: number, z: number): void;
  /** Mark axis-aligned region [min..max] as dirty */
  markDirtyRegion(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): void;
  /** Get set of dirty chunk ids (or null if full rebuild needed) */
  getDirtyChunkIds(): number[] | null;
  /** Clear dirty state after rebuild */
  clearDirty(): void;
  /** True if any region is dirty */
  hasDirty(): boolean;
}

function chunkId(cx: number, cy: number, cz: number, strideX: number, strideY: number): number {
  return cx + cy * strideX + cz * strideY;
}

export class SimpleChunkManager implements ChunkManager {
  readonly chunkSize: number;
  private _sx: number;
  private _sy: number;
  private _sz: number;
  private _dirty = new Set<number>();
  private _strideX: number;
  private _strideY: number;

  constructor(chunkSize: number, worldSx: number, worldSy: number, worldSz: number) {
    this.chunkSize = chunkSize;
    this._sx = Math.ceil(worldSx / chunkSize);
    this._sy = Math.ceil(worldSy / chunkSize);
    this._sz = Math.ceil(worldSz / chunkSize);
    this._strideX = this._sx;
    this._strideY = this._sx * this._sy;
  }

  markDirty(x: number, y: number, z: number) {
    const cx = Math.floor(x / this.chunkSize);
    const cy = Math.floor(y / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    if (cx >= 0 && cx < this._sx && cy >= 0 && cy < this._sy && cz >= 0 && cz < this._sz)
      this._dirty.add(chunkId(cx, cy, cz, this._strideX, this._strideY));
  }

  markDirtyRegion(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
    const c0x = Math.max(0, Math.floor(minX / this.chunkSize));
    const c0y = Math.max(0, Math.floor(minY / this.chunkSize));
    const c0z = Math.max(0, Math.floor(minZ / this.chunkSize));
    const c1x = Math.min(this._sx - 1, Math.floor(maxX / this.chunkSize));
    const c1y = Math.min(this._sy - 1, Math.floor(maxY / this.chunkSize));
    const c1z = Math.min(this._sz - 1, Math.floor(maxZ / this.chunkSize));
    for (let cz = c0z; cz <= c1z; cz++)
      for (let cy = c0y; cy <= c1y; cy++)
        for (let cx = c0x; cx <= c1x; cx++)
          this._dirty.add(chunkId(cx, cy, cz, this._strideX, this._strideY));
  }

  getDirtyChunkIds(): number[] | null {
    if (this._dirty.size === 0) return null;
    return Array.from(this._dirty);
  }

  clearDirty() {
    this._dirty.clear();
  }

  hasDirty(): boolean {
    return this._dirty.size > 0;
  }
}
