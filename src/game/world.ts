import { BlockRole } from '../engine/types';
import type { TriggerDef, GameSave } from '../engine/types';

export const WORLD_SIZE = 32;
const S = WORLD_SIZE;
const S2 = S * S;
const S3 = S * S * S;

export const DEFAULT_PALETTE = [
  '',          // 0 = air (unused slot)
  '#4CAF50',   // 1 grass
  '#795548',   // 2 dirt
  '#9E9E9E',   // 3 stone
  '#F44336',   // 4 red (deadly/lava)
  '#2196F3',   // 5 blue (water/bouncy)
  '#FFEB3B',   // 6 yellow (pickup/coin)
  '#FF9800',   // 7 orange
  '#9C27B0',   // 8 purple (portal)
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

  private _spawnPos: [number, number, number] = [16, 20, 16];

  constructor() {
    this.grid = new Uint8Array(S3);
    this.roles = new Uint8Array(S3);
    this.palette = [...DEFAULT_PALETTE];
  }

  private _idx(x: number, y: number, z: number): number {
    return x + y * S + z * S2;
  }

  get(x: number, y: number, z: number): number {
    if (x < 0 || x >= S || y < 0 || y >= S || z < 0 || z >= S) return 0;
    return this.grid[this._idx(x, y, z)];
  }

  getRole(x: number, y: number, z: number): number {
    if (x < 0 || x >= S || y < 0 || y >= S || z < 0 || z >= S) return 0;
    return this.roles[this._idx(x, y, z)];
  }

  set(x: number, y: number, z: number, blockId: number, role = BlockRole.SOLID) {
    if (x < 0 || x >= S || y < 0 || y >= S || z < 0 || z >= S) return;
    const i = this._idx(x, y, z);
    this.grid[i] = blockId;
    this.roles[i] = role;
    if (role === BlockRole.SPAWN) this._spawnPos = [x, y + 1, z];
  }

  clear(x: number, y: number, z: number) {
    if (x < 0 || x >= S || y < 0 || y >= S || z < 0 || z >= S) return;
    const i = this._idx(x, y, z);
    this.grid[i] = 0;
    this.roles[i] = 0;
  }

  isSolid(x: number, y: number, z: number): boolean {
    return this.get(Math.floor(x), Math.floor(y), Math.floor(z)) !== 0;
  }

  /** Check if floored coords have a specific role */
  roleAt(x: number, y: number, z: number): number {
    return this.getRole(Math.floor(x), Math.floor(y), Math.floor(z));
  }

  get spawnPos(): [number, number, number] {
    return [...this._spawnPos] as [number, number, number];
  }

  findSpawn(): [number, number, number] {
    for (let i = 0; i < S3; i++) {
      if (this.roles[i] === BlockRole.SPAWN) {
        const x = i % S;
        const y = Math.floor(i / S) % S;
        const z = Math.floor(i / S2);
        return [x, y + 1, z];
      }
    }
    return [16, 20, 16];
  }

  reset() {
    this.grid.fill(0);
    this.roles.fill(0);
    this.triggers = [];
    this.moverPaths = {};
    this.portalTargets = {};
    this._spawnPos = [16, 20, 16];
  }

  /** Generate a simple default level with a wheelchair person */
  generateDefault() {
    this.reset();
    // Ground layer
    for (let x = 0; x < S; x++)
      for (let z = 0; z < S; z++) {
        this.set(x, 0, z, 1); // grass
        if (x === 0 || x === S - 1 || z === 0 || z === S - 1)
          this.set(x, 0, z, 3); // stone border
      }
    // Spawn marker
    this.set(4, 1, 4, 6, BlockRole.SPAWN);

    // Small path
    for (let z = 4; z < 20; z++) {
      this.set(4, 0, z, 3);
      this.set(5, 0, z, 3);
    }

    // Wheelchair person at center of the world
    this._placeWheelchairPerson(14, 1, 14);
  }

  /**
   * Place a voxel wheelchair person at the given base position.
   * Facing +Z direction. ~8 voxels tall, ~6 wide.
   * Palette: 3=grey(frame), 4=red(seat), 5=blue(shirt),
   *          7=orange(skin), 9=white(eyes), 10=black(wheels/hair), 15=bluegrey(pants)
   */
  private _placeWheelchairPerson(bx: number, by: number, bz: number) {
    const B = 10; // black
    const G = 3;  // grey
    const R = 4;  // red
    const BL = 5; // blue
    const SK = 7; // skin (orange)
    const W = 9;  // white
    const P = 15; // pants (blue-grey)

    // Helper: place block relative to base
    const p = (dx: number, dy: number, dz: number, c: number) =>
      this.set(bx + dx, by + dy, bz + dz, c);

    // Helper: fill rect
    const fill = (x0: number, x1: number, y: number, z0: number, z1: number, c: number) => {
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++)
          p(x, y, z, c);
    };

    // ── y=0: Wheel bottoms + front casters ──
    p(0, 0, 1, B); p(0, 0, 2, B); p(0, 0, 3, B); p(0, 0, 4, B);  // left wheel bottom
    p(5, 0, 1, B); p(5, 0, 2, B); p(5, 0, 3, B); p(5, 0, 4, B);  // right wheel bottom
    p(2, 0, 5, B); p(3, 0, 5, B);                                   // front casters

    // ── y=1: Wheel sides + frame axle ──
    p(0, 1, 0, B); p(0, 1, 5, B);  // left wheel sides
    p(5, 1, 0, B); p(5, 1, 5, B);  // right wheel sides
    fill(1, 4, 1, 3, 3, G);         // axle bar
    p(1, 1, 4, G); p(1, 1, 5, G);   // left front strut
    p(4, 1, 4, G); p(4, 1, 5, G);   // right front strut

    // ── y=2: Wheel sides + seat frame ──
    p(0, 2, 0, B); p(0, 2, 5, B);  // left wheel sides
    p(5, 2, 0, B); p(5, 2, 5, B);  // right wheel sides
    fill(1, 4, 2, 1, 4, G);         // seat frame base

    // ── y=3: Wheel tops + seat cushion ──
    p(0, 3, 1, B); p(0, 3, 2, B); p(0, 3, 3, B); p(0, 3, 4, B);  // left wheel top
    p(5, 3, 1, B); p(5, 3, 2, B); p(5, 3, 3, B); p(5, 3, 4, B);  // right wheel top
    fill(1, 4, 3, 1, 4, R);         // red seat cushion 4x4

    // ── y=4: Legs + feet + armrests + backrest lower ──
    p(2, 4, 2, P); p(2, 4, 3, P); p(2, 4, 4, P);  // left leg
    p(3, 4, 2, P); p(3, 4, 3, P); p(3, 4, 4, P);  // right leg
    p(2, 4, 5, B); p(3, 4, 5, B);                   // shoes
    fill(1, 4, 4, 0, 0, G);                          // backrest lower
    p(0, 4, 1, G); p(0, 4, 2, G); p(0, 4, 3, G);   // left armrest
    p(5, 4, 1, G); p(5, 4, 2, G); p(5, 4, 3, G);   // right armrest

    // ── y=5: Lower torso + backrest ──
    fill(1, 4, 5, 0, 0, G);         // backrest mid
    p(1, 5, 1, BL); p(2, 5, 1, BL); p(3, 5, 1, BL); p(4, 5, 1, BL); // shirt row

    // ── y=6: Upper torso + arms ──
    fill(1, 4, 6, 0, 0, G);         // backrest top
    fill(1, 4, 6, 1, 1, BL);        // shirt row (4 wide)
    p(0, 6, 2, SK);                  // left hand (on wheel)
    p(5, 6, 2, SK);                  // right hand (on wheel)

    // ── y=7: Shoulders + arms ──
    fill(1, 4, 7, 1, 2, BL);        // shoulders wider
    p(0, 7, 1, SK); p(5, 7, 1, SK); // upper arms

    // ── y=8: Neck ──
    p(2, 8, 1, SK); p(3, 8, 1, SK);

    // ── y=9: Head lower ──
    fill(1, 4, 9, 0, 2, SK);        // head block 4x3
    p(2, 9, 2, W); p(3, 9, 2, W);   // eyes (white)

    // ── y=10: Head upper + hair ──
    fill(1, 4, 10, 0, 2, SK);       // head top
    fill(1, 4, 10, 0, 0, B);        // hair back

    // ── y=11: Hair ──
    fill(1, 4, 11, 0, 1, B);        // hair crown
  }

  serialize(): GameSave {
    return {
      v: 1,
      size: S,
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
    rleDecode(save.grid, this.grid);
    rleDecode(save.roles, this.roles);
    this.palette = save.palette;
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
    for (let j = 0; j < count && pos < target.length; j++) {
      target[pos++] = val;
    }
  }
}
