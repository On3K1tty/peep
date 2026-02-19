import { BlockRole } from '../engine/types';
import type { TriggerDef, GameSave } from '../engine/types';

/** 128x32x128 per level; chain via portals for larger worlds */
export const WORLD_SX = 128;
export const WORLD_SY = 32;
export const WORLD_SZ = 128;
const SX = WORLD_SX;
const SY = WORLD_SY;
const SZ = WORLD_SZ;
const S2 = SX * SY;
const S3 = SX * SY * SZ;

export const DEFAULT_PALETTE = [
  '',          // 0 = air
  '#4CAF50',   // 1 grass
  '#795548',   // 2 dirt
  '#9E9E9E',   // 3 stone
  '#F44336',   // 4 red
  '#2196F3',   // 5 blue
  '#FFEB3B',   // 6 yellow
  '#FF9800',   // 7 orange
  '#9C27B0',   // 8 purple
  '#FFFFFF',   // 9 white
  '#212121',   // 10 black
  '#E91E63',   // 11 pink
  '#00BCD4',   // 12 cyan
  '#8BC34A',   // 13 lime
  '#FF5722',   // 14 deep orange
  '#607D8B',   // 15 blue-grey
];

export class World {
  grid: Uint8Array;
  roles: Uint8Array;
  palette: string[];
  triggers: TriggerDef[] = [];
  moverPaths: Record<string, [number, number, number][]> = {};
  portalTargets: Record<string, [number, number, number]> = {};
  name = 'Untitled';

  private _spawnPos: [number, number, number] = [64, 1, 64];

  constructor() {
    this.grid = new Uint8Array(S3);
    this.roles = new Uint8Array(S3);
    this.palette = [...DEFAULT_PALETTE];
  }

  private _idx(x: number, y: number, z: number): number {
    return x + y * SX + z * S2;
  }

  /** Returns palette index; out-of-bounds = 1 (solid) for boundary collision */
  get(x: number, y: number, z: number): number {
    if (x < 0 || x >= SX || y < 0 || y >= SY || z < 0 || z >= SZ) return 1;
    return this.grid[this._idx(x, y, z)];
  }

  getRole(x: number, y: number, z: number): number {
    if (x < 0 || x >= SX || y < 0 || y >= SY || z < 0 || z >= SZ) return 0;
    return this.roles[this._idx(x, y, z)];
  }

  set(x: number, y: number, z: number, blockId: number, role = BlockRole.SOLID) {
    if (x < 0 || x >= SX || y < 0 || y >= SY || z < 0 || z >= SZ) return;
    const i = this._idx(x, y, z);
    this.grid[i] = blockId;
    this.roles[i] = role;
    if (role === BlockRole.SPAWN) this._spawnPos = [x, y + 1, z];
  }

  clear(x: number, y: number, z: number) {
    if (x < 0 || x >= SX || y < 0 || y >= SY || z < 0 || z >= SZ) return;
    const i = this._idx(x, y, z);
    this.grid[i] = 0;
    this.roles[i] = 0;
  }

  isSolid(x: number, y: number, z: number): boolean {
    return this.get(Math.floor(x), Math.floor(y), Math.floor(z)) !== 0;
  }

  /** Sims-Voxel: заполняет параллелепипед вокселями (база для домов). */
  putBox(x: number, y: number, z: number, sx: number, sy: number, sz: number, colorId: number) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const z0 = Math.max(0, Math.floor(z));
    const x1 = Math.min(SX, x0 + Math.max(0, Math.floor(sx)));
    const y1 = Math.min(SY, y0 + Math.max(0, Math.floor(sy)));
    const z1 = Math.min(SZ, z0 + Math.max(0, Math.floor(sz)));
    for (let ix = x0; ix < x1; ix++)
      for (let iy = y0; iy < y1; iy++)
        for (let iz = z0; iz < z1; iz++)
          this.set(ix, iy, iz, colorId);
  }

  /** Sims-Voxel: параллелепипед без внутренности (стены + пол + потолок). */
  putHollowBox(x: number, y: number, z: number, sx: number, sy: number, sz: number, colorId: number) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const z0 = Math.max(0, Math.floor(z));
    const x1 = Math.min(SX, x0 + Math.max(0, Math.floor(sx)));
    const y1 = Math.min(SY, y0 + Math.max(0, Math.floor(sy)));
    const z1 = Math.min(SZ, z0 + Math.max(0, Math.floor(sz)));
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    for (let ix = x0; ix < x1; ix++)
      for (let iz = z0; iz < z1; iz++) {
        this.set(ix, y0, iz, colorId);
        if (y1 - y0 > 1) this.set(ix, y1 - 1, iz, colorId);
      }
    for (let iy = y0; iy < y1; iy++)
      for (let iz = z0; iz < z1; iz++) {
        this.set(x0, iy, iz, colorId);
        if (x1 - x0 > 1) this.set(x1 - 1, iy, iz, colorId);
      }
    for (let ix = x0; ix < x1; ix++)
      for (let iy = y0; iy < y1; iy++) {
        this.set(ix, iy, z0, colorId);
        if (z1 - z0 > 1) this.set(ix, iy, z1 - 1, colorId);
      }
  }

  /** Sims-Voxel: куст — маленькая сфера листвы. bx,by,bz — центр базы. */
  putBush(x: number, y: number, z: number) {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    if (bx < 0 || bx >= SX || by < 0 || by >= SY || bz < 0 || bz >= SZ) return;
    const leaf = 1, r = 1;
    for (let dy = 0; dy <= 1 && by + dy < SY; dy++)
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          if (dx * dx + dy * dy + dz * dz <= r * r + 0.5)
            this.set(bx + dx, by + dy, bz + dz, leaf);
        }
  }

  /** Sims-Voxel: дерево. bx,by,bz — база ствола, height — высота. */
  putTree(x: number, y: number, z: number, height: number) {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    if (bx < 0 || bx >= SX || by < 0 || by >= SY || bz < 0 || bz >= SZ) return;
    const trunkH = Math.max(1, Math.floor(height * 0.5));
    const leafR = Math.max(1, Math.floor(height * 0.35));
    const wood = 2;
    const leaf = 1;
    for (let dy = 0; dy < trunkH && by + dy < SY; dy++) this.set(bx, by + dy, bz, wood);
    const cy = Math.min(by + trunkH, SY - 1);
    for (let dy = 0; dy <= leafR && cy + dy < SY; dy++)
      for (let dx = -leafR; dx <= leafR; dx++)
        for (let dz = -leafR; dz <= leafR; dz++) {
          const nx = bx + dx;
          const nz = bz + dz;
          if (nx < 0 || nx >= SX || nz < 0 || nz >= SZ) continue;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist <= leafR + 0.5) this.set(nx, cy + dy, nz, leaf);
        }
  }

  /** Штампы: дома, люди, животные, ландшафты. bx,by,bz — левый нижний угол. */
  putSmallHouse(bx: number, by: number, bz: number) {
    const W = 3, D = 4, H = 3;
    this.putHollowBox(bx, by, bz, W, H, D, 3);
    this.set(bx + 1, by + 1, bz, 0);
  }
  putBigHouse(bx: number, by: number, bz: number) {
    const W = 5, D = 6, H = 4;
    this.putHollowBox(bx, by, bz, W, H, D, 3);
    this.set(bx + 2, by + 1, bz, 0);
  }
  putToilet(bx: number, by: number, bz: number) {
    this.putBox(bx, by, bz, 2, 2, 2, 9);
  }
  putMan(bx: number, by: number, bz: number) {
    const B = 10, G = 3, SK = 7, W = 9;
    const p = (dx: number, dy: number, dz: number, c: number) => this.set(bx + dx, by + dy, bz + dz, c);
    p(0, 0, 1, B); p(1, 0, 1, B);
    p(0, 1, 0, B); p(1, 1, 0, B); p(0, 1, 1, G); p(1, 1, 1, G); p(0, 1, 2, B); p(1, 1, 2, B);
    p(0, 2, 1, G); p(1, 2, 1, G);
    p(0, 3, 1, SK); p(1, 3, 1, SK);
    p(0, 4, 1, SK); p(1, 4, 1, SK);
    p(0, 5, 1, W); p(1, 5, 1, W);
  }
  putWoman(bx: number, by: number, bz: number) {
    const B = 10, G = 11, SK = 7, W = 9;
    const p = (dx: number, dy: number, dz: number, c: number) => this.set(bx + dx, by + dy, bz + dz, c);
    p(0, 0, 1, B); p(1, 0, 1, B);
    p(0, 1, 0, B); p(1, 1, 0, B); p(0, 1, 1, G); p(1, 1, 1, G); p(0, 1, 2, B); p(1, 1, 2, B);
    p(0, 2, 1, G); p(1, 2, 1, G);
    p(0, 3, 1, SK); p(1, 3, 1, SK);
    p(0, 4, 1, SK); p(1, 4, 1, SK);
    p(0, 5, 1, W); p(1, 5, 1, W);
  }
  putCat(bx: number, by: number, bz: number) {
    const O = 7, W = 9, B = 10;
    const p = (dx: number, dy: number, dz: number, c: number) => this.set(bx + dx, by + dy, bz + dz, c);
    p(0, 0, 0, O); p(1, 0, 0, O);
    p(0, 1, 0, O); p(1, 1, 0, W); p(0, 1, 1, O); p(1, 1, 1, O);
  }
  putDog(bx: number, by: number, bz: number) {
    const B = 2, W = 9, O = 7;
    const p = (dx: number, dy: number, dz: number, c: number) => this.set(bx + dx, by + dy, bz + dz, c);
    p(0, 0, 0, B); p(1, 0, 0, B); p(2, 0, 0, B);
    p(0, 1, 0, B); p(1, 1, 0, W); p(2, 1, 0, B); p(1, 1, 1, O);
  }
  putUnicorn(bx: number, by: number, bz: number) {
    const W = 9, P = 11, Y = 6;
    const p = (dx: number, dy: number, dz: number, c: number) => this.set(bx + dx, by + dy, bz + dz, c);
    p(0, 0, 0, W); p(1, 0, 0, W);
    p(0, 1, 0, W); p(1, 1, 0, W); p(0, 1, 1, P);
    p(0, 2, 0, W); p(1, 2, 0, W); p(0, 2, 1, Y);
  }
  putHill(bx: number, by: number, bz: number) {
    const G = 1, D = 2;
    for (let r = 2; r >= 0; r--) {
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++)
          if (dx * dx + dz * dz <= r * r + 0.5)
            this.set(bx + dx, by + (2 - r), bz + dz, r === 0 ? G : D);
    }
  }
  putField(bx: number, by: number, bz: number) {
    this.putBox(bx, by, bz, 4, 1, 4, 1);
  }

  /** Grid for meshing: in play mode SPAWN blocks are treated as air (invisible). */
  getGridForDisplay(playMode: boolean): Uint8Array {
    if (!playMode) return this.grid;
    const out = new Uint8Array(this.grid.length);
    out.set(this.grid);
    for (let i = 0; i < this.roles.length; i++)
      if (this.roles[i] === BlockRole.SPAWN) out[i] = 0;
    return out;
  }

  roleAt(x: number, y: number, z: number): number {
    return this.getRole(Math.floor(x), Math.floor(y), Math.floor(z));
  }

  get spawnPos(): [number, number, number] {
    return [...this._spawnPos] as [number, number, number];
  }

  findSpawn(): [number, number, number] {
    for (let i = 0; i < S3; i++) {
      if (this.roles[i] === BlockRole.SPAWN) {
        const x = i % SX;
        const y = Math.floor(i / SX) % SY;
        const z = Math.floor(i / S2);
        return [x, y + 1, z];
      }
    }
    return [64, 1, 64];
  }

  reset() {
    this.grid.fill(0);
    this.roles.fill(0);
    this.triggers = [];
    this.moverPaths = {};
    this.portalTargets = {};
    this._spawnPos = [64, 1, 64];
  }

  generateDefault() {
    this.reset();
    for (let x = 0; x < SX; x++)
      for (let z = 0; z < SZ; z++) {
        this.set(x, 0, z, 1);
        if (x === 0 || x === SX - 1 || z === 0 || z === SZ - 1)
          this.set(x, 0, z, 3);
      }
    const cx = Math.floor(SX / 2);
    const cz = Math.floor(SZ / 2);
    this.set(cx, 1, cz - 10, 6, BlockRole.SPAWN);
    const pathLen = Math.min(20, SZ - cz + 6);
    for (let z = cz - 10; z < cz - 10 + pathLen; z++) {
      this.set(cx, 0, z, 3);
      this.set(cx + 1, 0, z, 3);
    }
    this._placeWheelchairPerson(cx - 3, 1, cz - 3);
  }

  private _placeWheelchairPerson(bx: number, by: number, bz: number) {
    const B = 10, G = 3, R = 4, BL = 5, SK = 7, W = 9, P = 15;
    const p = (dx: number, dy: number, dz: number, c: number) =>
      this.set(bx + dx, by + dy, bz + dz, c);
    const fill = (x0: number, x1: number, y: number, z0: number, z1: number, c: number) => {
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++) p(x, y, z, c);
    };
    p(0, 0, 1, B); p(0, 0, 2, B); p(0, 0, 3, B); p(0, 0, 4, B);
    p(5, 0, 1, B); p(5, 0, 2, B); p(5, 0, 3, B); p(5, 0, 4, B);
    p(2, 0, 5, B); p(3, 0, 5, B);
    p(0, 1, 0, B); p(0, 1, 5, B); p(5, 1, 0, B); p(5, 1, 5, B);
    fill(1, 4, 1, 3, 3, G); p(1, 1, 4, G); p(1, 1, 5, G); p(4, 1, 4, G); p(4, 1, 5, G);
    p(0, 2, 0, B); p(0, 2, 5, B); p(5, 2, 0, B); p(5, 2, 5, B);
    fill(1, 4, 2, 1, 4, G);
    p(0, 3, 1, B); p(0, 3, 2, B); p(0, 3, 3, B); p(0, 3, 4, B);
    p(5, 3, 1, B); p(5, 3, 2, B); p(5, 3, 3, B); p(5, 3, 4, B);
    fill(1, 4, 3, 1, 4, R);
    p(2, 4, 2, P); p(2, 4, 3, P); p(2, 4, 4, P); p(3, 4, 2, P); p(3, 4, 3, P); p(3, 4, 4, P);
    p(2, 4, 5, B); p(3, 4, 5, B);
    fill(1, 4, 4, 0, 0, G);
    p(0, 4, 1, G); p(0, 4, 2, G); p(0, 4, 3, G);
    p(5, 4, 1, G); p(5, 4, 2, G); p(5, 4, 3, G);
    fill(1, 4, 5, 0, 0, G);
    p(1, 5, 1, BL); p(2, 5, 1, BL); p(3, 5, 1, BL); p(4, 5, 1, BL);
    fill(1, 4, 6, 0, 0, G); fill(1, 4, 6, 1, 1, BL);
    p(0, 6, 2, SK); p(5, 6, 2, SK);
    fill(1, 4, 7, 1, 2, BL); p(0, 7, 1, SK); p(5, 7, 1, SK);
    p(2, 8, 1, SK); p(3, 8, 1, SK);
    fill(1, 4, 9, 0, 2, SK); p(2, 9, 2, W); p(3, 9, 2, W);
    fill(1, 4, 10, 0, 2, SK); fill(1, 4, 10, 0, 0, B);
    fill(1, 4, 11, 0, 1, B);
  }

  serialize(): GameSave {
    return {
      v: 1,
      size: [SX, SY, SZ],
      grid: rleEncode(this.grid),
      roles: rleEncode(this.roles),
      palette: this.palette,
      triggers: this.triggers,
      moverPaths: this.moverPaths,
      portalTargets: this.portalTargets,
      name: this.name,
    };
  }

  deserialize(save: GameSave) {
    this.reset();
    const [sx, sy, sz2] = Array.isArray(save.size) ? save.size : [save.size, save.size, save.size];
    const saveLen = sx * sy * sz2;
    if (saveLen === S3) {
      rleDecode(save.grid, this.grid);
      rleDecode(save.roles, this.roles);
    } else {
      const tmpGrid = new Uint8Array(saveLen);
      const tmpRoles = new Uint8Array(saveLen);
      rleDecode(save.grid, tmpGrid);
      rleDecode(save.roles, tmpRoles);
      const copyLen = Math.min(sx, SX) * Math.min(sy, SY) * Math.min(sz2, SZ);
      for (let i = 0; i < copyLen; i++) {
        const x = i % sx, y = Math.floor(i / sx) % sy, z = Math.floor(i / (sx * sy));
        if (x < SX && y < SY && z < SZ) {
          const dst = x + y * SX + z * S2;
          this.grid[dst] = tmpGrid[i];
          this.roles[dst] = tmpRoles[i];
        }
      }
    }
    this.palette = save.palette || this.palette;
    this.triggers = save.triggers || [];
    this.moverPaths = save.moverPaths || {};
    this.portalTargets = save.portalTargets || {};
    this.name = save.name || 'Untitled';
    this._spawnPos = this.findSpawn();
  }
}

function rleEncode(data: Uint8Array): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const val = data[i];
    let count = 1;
    while (i + count < data.length && data[i + count] === val && count < 255) count++;
    out.push(count, val);
    i += count;
  }
  return out;
}

function rleDecode(rle: number[], target: Uint8Array) {
  let pos = 0;
  for (let i = 0; i < rle.length; i += 2) {
    const count = rle[i];
    const val = rle[i + 1];
    for (let j = 0; j < count && pos < target.length; j++) target[pos++] = val;
  }
}
