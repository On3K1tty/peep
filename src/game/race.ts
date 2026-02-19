import { playSound } from './sound';

const CORRIDOR_W = 5;
const CORRIDOR_LEN = 30;
const PLAYER_W = 0.7;
const PLAYER_H = 1.0;
const BOT_W = 0.7;
const BOT_H = 1.0;
const PILL_R = 0.2;
const BED_W = 1.8;
const BED_H = 0.8;
const DOC_W = 0.5;
const DOC_H = 0.5;

interface Obstacle {
  x: number;
  z: number;
  w: number;
  h: number;
  type: 'bed' | 'doctor';
}

interface Pill {
  x: number;
  z: number;
  collected: boolean;
}

export class Race {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _wrap: HTMLElement;
  private _raf = 0;
  private _running = false;
  private _lastTime = 0;
  private _getSteer: () => number;

  private _px = CORRIDOR_W / 2;
  private _pz = 2;
  private _pSpeed = 0;
  private _steer = 0;
  private _pills = 0;

  private _bx = CORRIDOR_W / 2;
  private _bz = 2;
  private _bSpeed = 0;
  private _bDodge = 0;
  private _bDodgeTimer = 0;

  private _obstacles: Obstacle[] = [];
  private _pillList: Pill[] = [];

  private _countdown = 3;
  private _started = false;
  private _finished = false;
  private _time = 0;
  private _goTime = 0;
  private _touchId = -1;
  private _touchX = 0;

  onFinish?: (won: boolean) => void;

  constructor(container: HTMLElement, getSteer?: () => number) {
    this._getSteer = getSteer || (() => 0);

    this._wrap = document.createElement('div');
    this._wrap.className = 'race-wrap';
    container.appendChild(this._wrap);

    this._canvas = document.createElement('canvas');
    this._canvas.className = 'race-canvas';
    this._wrap.appendChild(this._canvas);

    this._ctx = this._canvas.getContext('2d')!;
    this._resize();
    window.addEventListener('resize', this._onResize);

    this._generateCorridor();

    this._canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    this._canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    this._canvas.addEventListener('touchend', this._onTouchEnd);

    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKeyUp);
  }

  private _onResize = () => this._resize();

  private _resize() {
    this._canvas.width = window.innerWidth;
    this._canvas.height = window.innerHeight;
  }

  private _generateCorridor() {
    for (let z = 6; z < CORRIDOR_LEN - 4; z += 5) {
      const side = z % 2 === 0 ? 0.2 : CORRIDOR_W - BED_W - 0.2;
      this._obstacles.push({ x: side, z, w: BED_W, h: BED_H, type: 'bed' });
    }

    for (let z = 4; z < CORRIDOR_LEN - 3; z += 4) {
      const dx = 0.8 + Math.random() * (CORRIDOR_W - 1.6);
      this._obstacles.push({ x: dx - DOC_W / 2, z, w: DOC_W, h: DOC_H, type: 'doctor' });
    }

    for (let z = 3; z < CORRIDOR_LEN - 2; z += 2.5) {
      const px = 0.5 + Math.random() * (CORRIDOR_W - 1);
      this._pillList.push({ x: px, z, collected: false });
    }
  }

  private _onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    this._touchId = t.identifier;
    this._touchX = t.clientX;
    this._updateTouchSteer();
  };

  private _onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this._touchId) {
        this._touchX = e.changedTouches[i].clientX;
        this._updateTouchSteer();
      }
    }
  };

  private _onTouchEnd = () => {
    this._touchId = -1;
    this._steer = 0;
  };

  private _updateTouchSteer() {
    const mid = window.innerWidth / 2;
    this._steer = this._touchX < mid ? -1 : 1;
  }

  private _onKey = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this._steer = -1;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') this._steer = 1;
  };

  private _onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA' ||
        e.code === 'ArrowRight' || e.code === 'KeyD') this._steer = 0;
  };

  start() {
    this._running = true;
    this._lastTime = performance.now();
    this._countdown = 3;
    this._started = false;
    this._finished = false;
    this._pSpeed = 0;
    this._bSpeed = 0;
    this._pz = 2;
    this._bz = 2;
    this._px = CORRIDOR_W / 2;
    this._bx = CORRIDOR_W / 2;
    this._pills = 0;
    this._time = 0;
    this._goTime = 0;
    this._tick(this._lastTime);
  }

  private _tick = (now: number) => {
    if (!this._running) return;
    this._raf = requestAnimationFrame(this._tick);

    const dt = Math.min((now - this._lastTime) / 1000, 0.1);
    this._lastTime = now;
    this._time += dt;

    if (!this._started) {
      this._countdown -= dt;
      if (this._countdown <= 0) {
        this._started = true;
        this._goTime = this._time;
        playSound('win');
      }
    }

    if (this._started && !this._finished) {
      const gyroSteer = this._getSteer();
      const totalSteer = Math.abs(gyroSteer) > 0.1 ? gyroSteer : this._steer;

      this._pSpeed = Math.min(this._pSpeed + 4 * dt, 8);
      this._pz += this._pSpeed * dt;
      this._px += totalSteer * 4 * dt;
      this._px = Math.max(PLAYER_W / 2, Math.min(CORRIDOR_W - PLAYER_W / 2, this._px));

      this._bSpeed = Math.min(this._bSpeed + 3.5 * dt, 7 + Math.random() * 0.5);
      this._bz += this._bSpeed * dt;
      this._bDodgeTimer -= dt;
      if (this._bDodgeTimer <= 0) {
        this._bDodge = (Math.random() - 0.5) * 3;
        this._bDodgeTimer = 0.5 + Math.random() * 1.5;
      }
      this._bx += this._bDodge * dt;
      this._bx = Math.max(BOT_W / 2, Math.min(CORRIDOR_W - BOT_W / 2, this._bx));

      for (const pill of this._pillList) {
        if (pill.collected) continue;
        if (Math.abs(this._px - pill.x) < 0.6 && Math.abs(this._pz - pill.z) < 0.6) {
          pill.collected = true;
          this._pills++;
          playSound('pickup');
        }
      }

      if (this._pz >= CORRIDOR_LEN - 1 || this._bz >= CORRIDOR_LEN - 1) {
        this._finished = true;
        const won = this._pz >= this._bz;
        playSound(won ? 'win' : 'lose');
        setTimeout(() => this.onFinish?.(won), 1500);
      }
    }

    this._render();
  };

  private _render() {
    const ctx = this._ctx;
    const cw = this._canvas.width;
    const ch = this._canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, cw, ch);

    const scale = (cw * 0.7) / CORRIDOR_W;
    const corridorScreenW = CORRIDOR_W * scale;
    const offsetX = (cw - corridorScreenW) / 2;

    // Camera: player at bottom 30% of screen
    const cameraZ = this._pz - (ch * 0.3) / scale;

    ctx.save();
    ctx.translate(offsetX, ch);
    ctx.scale(scale, -scale);
    ctx.translate(0, -cameraZ);

    // Floor tiles
    const startZ = Math.floor(cameraZ) - 1;
    const endZ = Math.ceil(cameraZ + ch / scale) + 1;

    for (let z = startZ; z <= endZ; z++) {
      for (let x = 0; x < CORRIDOR_W; x++) {
        ctx.fillStyle = (x + z) % 2 === 0 ? '#B0BEC5' : '#90A4AE';
        ctx.fillRect(x, z, 1, 1);
      }
    }

    // Walls
    ctx.fillStyle = '#ECEFF1';
    ctx.fillRect(-0.3, startZ, 0.3, endZ - startZ + 1);
    ctx.fillRect(CORRIDOR_W, startZ, 0.3, endZ - startZ + 1);
    // Wall inner edge (shadow)
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, startZ, 0.08, endZ - startZ + 1);
    ctx.fillRect(CORRIDOR_W - 0.08, startZ, 0.08, endZ - startZ + 1);

    // Lane dividers (subtle dashes)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.04;
    ctx.setLineDash([0.3, 0.5]);
    for (let lane = 1; lane < 5; lane++) {
      ctx.beginPath();
      ctx.moveTo(lane, startZ);
      ctx.lineTo(lane, endZ);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Door / finish line
    if (endZ > CORRIDOR_LEN - 5) {
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(0, CORRIDOR_LEN - 1, CORRIDOR_W, 0.3);
      ctx.fillStyle = '#81C784';
      ctx.fillRect(0, CORRIDOR_LEN - 1, CORRIDOR_W, 0.05);
    }

    // Obstacles
    for (const obs of this._obstacles) {
      if (obs.z < cameraZ - 2 || obs.z > cameraZ + ch / scale + 2) continue;
      if (obs.type === 'bed') {
        ctx.fillStyle = '#795548';
        ctx.fillRect(obs.x, obs.z, obs.w, obs.h);
        ctx.fillStyle = '#EFEBE9';
        ctx.fillRect(obs.x + 0.08, obs.z + 0.08, obs.w - 0.16, obs.h - 0.16);
        ctx.fillStyle = '#BCAAA4';
        ctx.fillRect(obs.x + 0.08, obs.z + 0.08, 0.25, obs.h - 0.16);
      } else {
        // Doctor body (blue scrubs)
        ctx.fillStyle = '#2196F3';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w / 2, obs.z + obs.h * 0.35, obs.w * 0.45, 0, Math.PI * 2);
        ctx.fill();
        // White coat top
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w / 2, obs.z + obs.h * 0.7, obs.w * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Pills
    for (const pill of this._pillList) {
      if (pill.collected) continue;
      if (pill.z < cameraZ - 1 || pill.z > cameraZ + ch / scale + 1) continue;
      const bob = Math.sin(this._time * 4 + pill.z) * 0.05;
      ctx.fillStyle = '#FFEB3B';
      ctx.beginPath();
      ctx.arc(pill.x, pill.z + bob, PILL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F9A825';
      ctx.beginPath();
      ctx.arc(pill.x, pill.z + bob, PILL_R * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bot
    ctx.fillStyle = '#F44336';
    ctx.fillRect(this._bx - BOT_W / 2, this._bz - BOT_H / 2, BOT_W, BOT_H);
    ctx.strokeStyle = '#B71C1C';
    ctx.lineWidth = 0.05;
    ctx.strokeRect(this._bx - BOT_W / 2, this._bz - BOT_H / 2, BOT_W, BOT_H);
    // Bot wheels
    ctx.fillStyle = '#212121';
    ctx.fillRect(this._bx - BOT_W / 2 - 0.08, this._bz - BOT_H * 0.3, 0.08, 0.25);
    ctx.fillRect(this._bx + BOT_W / 2, this._bz - BOT_H * 0.3, 0.08, 0.25);

    // Player (wheelchair from above)
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(this._px - PLAYER_W / 2, this._pz - PLAYER_H / 2, PLAYER_W, PLAYER_H);
    // Wheelchair handles
    ctx.fillStyle = '#388E3C';
    ctx.fillRect(this._px - PLAYER_W / 2 - 0.1, this._pz - 0.15, 0.1, 0.3);
    ctx.fillRect(this._px + PLAYER_W / 2, this._pz - 0.15, 0.1, 0.3);
    // Wheels
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(this._px - PLAYER_W / 2 + 0.12, this._pz - PLAYER_H / 2 + 0.12, 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this._px + PLAYER_W / 2 - 0.12, this._pz - PLAYER_H / 2 + 0.12, 0.12, 0, Math.PI * 2);
    ctx.fill();
    // Front casters
    ctx.beginPath();
    ctx.arc(this._px - PLAYER_W / 4, this._pz + PLAYER_H / 2 - 0.08, 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this._px + PLAYER_W / 4, this._pz + PLAYER_H / 2 - 0.08, 0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // ── HUD (screen space) ──

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 4;

    // Pill count
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`\u{1F48A} ${this._pills}`, cw / 2, 32);

    // Position indicator
    const ahead = this._pz > this._bz;
    ctx.font = 'bold 16px system-ui';
    ctx.fillStyle = ahead ? '#4CAF50' : '#F44336';
    ctx.fillText(ahead ? '1st' : '2nd', cw / 2, 54);

    ctx.shadowBlur = 0;
    ctx.restore();

    // Countdown
    if (!this._started && this._countdown > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = '#4CAF50';
      ctx.font = `bold ${Math.min(cw * 0.2, 80)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(76,175,80,0.5)';
      ctx.shadowBlur = 20;
      ctx.fillText(String(Math.ceil(this._countdown)), cw / 2, ch / 2);
      ctx.shadowBlur = 0;
    } else if (this._started && this._time - this._goTime < 0.8) {
      ctx.fillStyle = '#4CAF50';
      ctx.font = `bold ${Math.min(cw * 0.15, 60)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(76,175,80,0.5)';
      ctx.shadowBlur = 20;
      const alpha = 1 - (this._time - this._goTime) / 0.8;
      ctx.globalAlpha = alpha;
      ctx.fillText('GO!', cw / 2, ch / 2);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    // Finish overlay
    if (this._finished) {
      const won = this._pz >= this._bz;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = won ? '#4CAF50' : '#F44336';
      ctx.font = `bold ${Math.min(cw * 0.12, 48)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      ctx.fillText(won ? 'YOU WIN!' : 'YOU LOSE', cw / 2, ch / 2);
      ctx.shadowBlur = 0;
    }

    // Touch indicators at bottom
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '20px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('\u25C0', cw * 0.15, ch - 16);
    ctx.fillText('\u25B6', cw * 0.85, ch - 16);

    if (this._touchId >= 0) {
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#fff';
      if (this._steer < 0) ctx.fillRect(0, ch - 80, cw / 2, 80);
      else ctx.fillRect(cw / 2, ch - 80, cw / 2, 80);
      ctx.globalAlpha = 1;
    }
  }

  destroy() {
    this._running = false;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('resize', this._onResize);
    this._canvas.removeEventListener('touchstart', this._onTouchStart);
    this._canvas.removeEventListener('touchmove', this._onTouchMove);
    this._canvas.removeEventListener('touchend', this._onTouchEnd);
    this._wrap.remove();
  }
}
