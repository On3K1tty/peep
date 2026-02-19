import { BlockRole } from '../engine/types';
import type { World } from './world';

const GRAVITY = 25;
const JUMP_VEL = 9;
const MOVE_SPEED = 6;
const PLAYER_H = 1.6;
const PLAYER_R = 0.3;

export interface PlayerState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number;
  grounded: boolean;
  alive: boolean;
  score: number;
  won: boolean;
}

export class Player {
  state: PlayerState;
  private _world: World;
  private _pickedUp = new Set<string>();

  constructor(world: World) {
    this._world = world;
    const [sx, sy, sz] = world.findSpawn();
    this.state = {
      x: sx + 0.5, y: sy, z: sz + 0.5,
      vx: 0, vy: 0, vz: 0,
      yaw: 0, grounded: false,
      alive: true, score: 0, won: false,
    };
  }

  respawn() {
    const [sx, sy, sz] = this._world.findSpawn();
    this.state.x = sx + 0.5;
    this.state.y = sy;
    this.state.z = sz + 0.5;
    this.state.vx = 0; this.state.vy = 0; this.state.vz = 0;
    this.state.grounded = false;
    this.state.alive = true;
    this.state.won = false;
  }

  /** Apply movement input (forward/right relative to yaw) */
  move(forward: number, right: number, jump: boolean, dt: number): string | null {
    if (!this.state.alive || this.state.won) return null;

    const s = this.state;
    const sin = Math.sin(s.yaw);
    const cos = Math.cos(s.yaw);

    // Horizontal movement
    const mx = (-forward * sin + right * cos) * MOVE_SPEED;
    const mz = (forward * cos + right * sin) * MOVE_SPEED;
    s.vx = mx;
    s.vz = mz;

    // Gravity
    s.vy -= GRAVITY * dt;

    // Jump
    if (jump && s.grounded) {
      s.vy = JUMP_VEL;
      s.grounded = false;
      return 'jump';
    }

    // Integrate position with collision
    let sfx: string | null = null;
    sfx = this._integrate(dt);

    return sfx;
  }

  private _integrate(dt: number): string | null {
    const s = this.state;
    const w = this._world;
    let sfx: string | null = null;

    // X axis
    const nx = s.x + s.vx * dt;
    if (!this._collidesAt(nx, s.y, s.z)) {
      s.x = nx;
    } else {
      s.vx = 0;
    }

    // Z axis
    const nz = s.z + s.vz * dt;
    if (!this._collidesAt(s.x, s.y, nz)) {
      s.z = nz;
    } else {
      s.vz = 0;
    }

    // Y axis
    const ny = s.y + s.vy * dt;
    if (!this._collidesAt(s.x, ny, s.z)) {
      s.y = ny;
      s.grounded = false;
    } else {
      if (s.vy < 0) {
        s.y = Math.floor(s.y) + 0.001;
        s.grounded = true;
      }
      // Bouncy block check
      const byf = s.vy < 0 ? Math.floor(s.y - 0.1) : Math.floor(s.y + PLAYER_H);
      const role = w.roleAt(Math.floor(s.x), byf, Math.floor(s.z));
      if (role === BlockRole.BOUNCY) {
        s.vy = -s.vy * 1.3;
        s.grounded = false;
        sfx = 'jump';
      } else {
        s.vy = 0;
      }
    }

    // Check block at feet for role interactions
    const fx = Math.floor(s.x);
    const fy = Math.floor(s.y);
    const fz = Math.floor(s.z);

    const footRole = w.roleAt(fx, fy, fz);
    const bodyRole = w.roleAt(fx, fy + 1, fz);
    const role = footRole || bodyRole;

    if (role === BlockRole.DEADLY) {
      s.alive = false;
      sfx = 'hit';
    } else if (role === BlockRole.PICKUP) {
      const ry = footRole === BlockRole.PICKUP ? fy : fy + 1;
      const pk = `${fx},${ry},${fz}`;
      if (!this._pickedUp.has(pk)) {
        this._pickedUp.add(pk);
        w.clear(fx, ry, fz);
        s.score++;
        sfx = 'pickup';
      }
    } else if (role === BlockRole.FINISH) {
      s.won = true;
      sfx = 'win';
    } else if (role === BlockRole.PORTAL) {
      const pk = `${fx},${fy},${fz}`;
      const target = w.portalTargets[pk];
      if (target) {
        s.x = target[0] + 0.5;
        s.y = target[1];
        s.z = target[2] + 0.5;
        sfx = 'pickup';
      }
    }

    // Void death
    if (s.y < -5) { s.alive = false; sfx = 'hit'; }

    return sfx;
  }

  private _collidesAt(x: number, y: number, z: number): boolean {
    const w = this._world;
    const r = PLAYER_R;
    // Check a few points around the player capsule
    for (let dy = 0; dy < PLAYER_H; dy += 0.8) {
      const cy = y + dy;
      if (w.isSolid(x - r, cy, z - r) ||
          w.isSolid(x + r, cy, z - r) ||
          w.isSolid(x - r, cy, z + r) ||
          w.isSolid(x + r, cy, z + r)) {
        return true;
      }
    }
    // Head
    if (w.isSolid(x, y + PLAYER_H, z)) return true;
    return false;
  }
}
