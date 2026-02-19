import { Renderer, Camera } from '../engine/renderer';
import { WorldMesh } from '../engine/voxel';
import { World, WORLD_SIZE } from './world';
import { playSound } from './sound';

const S = WORLD_SIZE;
const CORRIDOR_W = 7;
const CORRIDOR_H = 5;
const CORRIDOR_L = 30;
const VOXEL_SZ = 10;

export class Race {
  private _container: HTMLElement;
  private _wrap: HTMLElement;
  private _renderer: Renderer;
  private _cam: Camera;
  private _world: World;
  private _mesh: WorldMesh;
  private _hud: HTMLElement;
  private _raf = 0;
  private _running = false;
  private _lastTime = 0;

  // Player
  private _px = 3.5; private _py = 1; private _pz = 2;
  private _pSpeed = 0;
  private _steer = 0;
  private _pills = 0;

  // Bot
  private _bx = 3.5; private _bz = 2;
  private _bSpeed = 0;
  private _bDodge = 0;
  private _bDodgeTimer = 0;

  // Sprites (simple divs in 3D)
  private _playerEl: HTMLElement;
  private _botEl: HTMLElement;
  private _pillEls: { el: HTMLElement; z: number; x: number; collected: boolean }[] = [];

  // Countdown
  private _countdown = 3;
  private _goEl: HTMLElement;
  private _pillsEl: HTMLElement;
  private _posEl: HTMLElement;
  private _started = false;
  private _finished = false;

  onFinish?: (won: boolean) => void;

  constructor(container: HTMLElement) {
    this._container = container;

    this._wrap = document.createElement('div');
    this._wrap.style.cssText = 'position:fixed;inset:0;z-index:250;';
    container.appendChild(this._wrap);

    // Build corridor world
    this._world = new World();
    this._buildCorridor();

    // Renderer
    this._cam = new Camera('orbit');
    this._cam.state.distance = 12;
    this._cam.state.rotationX = -15;
    this._cam.state.rotationY = 0;
    this._cam.state.target.set(this._px, 2, this._pz + 3);
    this._renderer = new Renderer(this._wrap, this._cam, 500, VOXEL_SZ);

    this._mesh = new WorldMesh(VOXEL_SZ);
    this._renderer.world.appendChild(this._mesh.el);
    this._mesh.el.style.transformStyle = 'preserve-3d';
    this._mesh.rebuildFromGrid(this._world.grid, this._world.palette);

    // Player sprite (green block)
    this._playerEl = this._makeSprite('#4CAF50', 0.8, 1.2);
    this._renderer.world.appendChild(this._playerEl);

    // Bot sprite (red block)
    this._botEl = this._makeSprite('#F44336', 0.8, 1.2);
    this._renderer.world.appendChild(this._botEl);

    // Pill sprites
    for (let z = 4; z < CORRIDOR_L - 2; z += 3) {
      const x = 1.5 + Math.random() * (CORRIDOR_W - 3);
      const el = this._makeSprite('#FFEB3B', 0.4, 0.4);
      this._renderer.world.appendChild(el);
      this._pillEls.push({ el, z: z + 0.5, x, collected: false });
    }

    // Race HUD
    this._hud = document.createElement('div');
    this._hud.className = 'race-hud';
    this._hud.innerHTML =
      '<div class="race-pills">0</div>' +
      '<div class="race-pos"></div>' +
      '<div class="race-go"></div>' +
      '<div class="race-steer">' +
        '<button class="rs-l">&larr;</button>' +
        '<button class="rs-r">&rarr;</button>' +
      '</div>';
    this._wrap.appendChild(this._hud);
    this._pillsEl = this._hud.querySelector('.race-pills')!;
    this._posEl = this._hud.querySelector('.race-pos')!;
    this._goEl = this._hud.querySelector('.race-go')!;

    // Steer buttons
    const steerL = this._hud.querySelector('.rs-l')!;
    const steerR = this._hud.querySelector('.rs-r')!;
    const setSteer = (v: number) => { this._steer = v; };
    steerL.addEventListener('touchstart', (e) => { e.preventDefault(); setSteer(-1); }, { passive: false });
    steerL.addEventListener('touchend', () => setSteer(0));
    steerL.addEventListener('mousedown', () => setSteer(-1));
    steerL.addEventListener('mouseup', () => setSteer(0));
    steerR.addEventListener('touchstart', (e) => { e.preventDefault(); setSteer(1); }, { passive: false });
    steerR.addEventListener('touchend', () => setSteer(0));
    steerR.addEventListener('mousedown', () => setSteer(1));
    steerR.addEventListener('mouseup', () => setSteer(0));

    // Keyboard
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKeyUp);
  }

  private _onKey = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this._steer = -1;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') this._steer = 1;
  };
  private _onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') this._steer = 0;
  };

  private _buildCorridor() {
    const w = this._world;
    w.reset();
    const WHITE = 9, GREY = 3, BROWN = 2, GREEN = 1;

    for (let z = 0; z < CORRIDOR_L; z++) {
      for (let x = 0; x < CORRIDOR_W; x++) {
        // Floor
        w.set(x, 0, z, (x + z) % 2 === 0 ? GREY : WHITE);
        // Ceiling
        w.set(x, CORRIDOR_H, z, GREY);
        // Walls
        if (x === 0 || x === CORRIDOR_W - 1) {
          for (let y = 1; y <= CORRIDOR_H; y++) w.set(x, y, z, WHITE);
        }
      }
    }

    // Back wall
    for (let x = 0; x < CORRIDOR_W; x++)
      for (let y = 0; y <= CORRIDOR_H; y++)
        w.set(x, y, 0, GREY);

    // Door at end (green)
    for (let x = 2; x < CORRIDOR_W - 2; x++)
      for (let y = 1; y < CORRIDOR_H; y++)
        w.set(x, y, CORRIDOR_L - 1, GREEN);

    // Hospital beds (obstacles)
    for (let z = 6; z < CORRIDOR_L - 4; z += 7) {
      const side = z % 2 === 0 ? 1 : CORRIDOR_W - 3;
      for (let dx = 0; dx < 2; dx++) {
        w.set(side + dx, 1, z, BROWN);
        w.set(side + dx, 1, z + 1, BROWN);
      }
    }

    // Standing people (thin columns)
    for (let z = 5; z < CORRIDOR_L - 3; z += 5) {
      const px = 2 + Math.floor(Math.random() * (CORRIDOR_W - 4));
      w.set(px, 1, z, 5); // blue
      w.set(px, 2, z, 9); // white (coat)
    }
  }

  private _makeSprite(color: string, w: number, h: number): HTMLElement {
    const el = document.createElement('div');
    const vs = VOXEL_SZ;
    el.style.cssText =
      `position:absolute;width:${w * vs}px;height:${h * vs}px;` +
      `background:${color};border-radius:2px;` +
      `transform-style:preserve-3d;transform-origin:50% 100%;`;
    return el;
  }

  private _positionSprite(el: HTMLElement, x: number, y: number, z: number) {
    const vs = VOXEL_SZ;
    el.style.transform = `translate3d(${x * vs}px,${-y * vs}px,${z * vs}px)`;
  }

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
    this._bx = 3.5;
    this._pills = 0;

    this._goEl.textContent = '3';
    this._goEl.classList.add('show');

    this._tick(this._lastTime);
  }

  private _tick = (now: number) => {
    if (!this._running) return;
    this._raf = requestAnimationFrame(this._tick);

    const dt = Math.min((now - this._lastTime) / 1000, 0.1);
    this._lastTime = now;

    // Countdown
    if (!this._started) {
      this._countdown -= dt;
      if (this._countdown > 0) {
        this._goEl.textContent = String(Math.ceil(this._countdown));
      } else {
        this._goEl.textContent = 'GO!';
        this._started = true;
        setTimeout(() => this._goEl.classList.remove('show'), 600);
        playSound('win');
      }
    }

    if (this._started && !this._finished) {
      // Player
      this._pSpeed = Math.min(this._pSpeed + 4 * dt, 8);
      this._pz += this._pSpeed * dt;
      this._px += this._steer * 4 * dt;
      this._px = Math.max(1.2, Math.min(CORRIDOR_W - 1.2, this._px));

      // Bot AI
      this._bSpeed = Math.min(this._bSpeed + 3.5 * dt, 7 + Math.random() * 0.5);
      this._bz += this._bSpeed * dt;
      this._bDodgeTimer -= dt;
      if (this._bDodgeTimer <= 0) {
        this._bDodge = (Math.random() - 0.5) * 3;
        this._bDodgeTimer = 0.5 + Math.random() * 1.5;
      }
      this._bx += this._bDodge * dt;
      this._bx = Math.max(1.2, Math.min(CORRIDOR_W - 1.2, this._bx));

      // Pill collection
      for (const pill of this._pillEls) {
        if (pill.collected) continue;
        const dist = Math.abs(this._px - pill.x) + Math.abs(this._pz - pill.z);
        if (dist < 1.2) {
          pill.collected = true;
          pill.el.style.display = 'none';
          this._pills++;
          playSound('pickup');
        }
      }

      // Check finish
      if (this._pz >= CORRIDOR_L - 1.5 || this._bz >= CORRIDOR_L - 1.5) {
        this._finished = true;
        const won = this._pz >= this._bz;
        playSound(won ? 'win' : 'lose');
        setTimeout(() => this.onFinish?.(won), 1500);
      }

      // HUD
      this._pillsEl.textContent = `\u{1F48A} ${this._pills}`;
      const ahead = this._pz > this._bz;
      this._posEl.textContent = ahead ? '1st' : '2nd';
      this._posEl.style.color = ahead ? '#4CAF50' : '#F44336';
    }

    // Position sprites
    this._positionSprite(this._playerEl, this._px - 0.4, 1, this._pz);
    this._positionSprite(this._botEl, this._bx - 0.4, 1, this._bz);
    for (const pill of this._pillEls) {
      if (!pill.collected) {
        this._positionSprite(pill.el, pill.x - 0.2, 1.8 + Math.sin(now * 0.003) * 0.2, pill.z);
      }
    }

    // Camera follows player (third person)
    const cam = this._cam.state;
    cam.target.x += (this._px - cam.target.x) * 0.1;
    cam.target.y = 2.5;
    cam.target.z += (this._pz + 2 - cam.target.z) * 0.1;
    cam.rotationY += (0 - cam.rotationY) * 0.05;

    this._renderer.render();
  };

  destroy() {
    this._running = false;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKeyUp);
    this._wrap.remove();
  }
}
