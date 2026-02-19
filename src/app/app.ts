import { Engine } from '../engine/engine';
import { WorldMesh } from '../engine/voxel';
import { World, WORLD_SX, WORLD_SY, WORLD_SZ } from '../game/world';
import { Player } from '../game/player';
import { TriggerRuntime, type TriggerEvent } from '../game/triggers';
import { GyroCamera } from '../game/gyro';
import { HUD } from '../game/hud';
import { playSound } from '../game/sound';
import { Race } from '../game/race';
import { Editor } from '../editor/editor';
import { saveGame, loadGame, encodeForURL, decodeFromURL } from './storage';
import { tgInit, tgHaptic, tgShare, tgBackButton } from './tg';
import { initLang, t } from './i18n';

type AppMode = 'splash' | 'race' | 'edit' | 'play';

export class App {
  private _container: HTMLElement;
  private _engine: Engine;
  private _world: World;
  private _mesh: WorldMesh;
  private _editor!: Editor;
  private _player: Player | null = null;
  private _triggers: TriggerRuntime;
  private _gyro: GyroCamera;
  private _hud: HUD;
  private _mode: AppMode = 'splash';
  private _jumpPressed = false;
  private _shootPressed = false;
  private _health = 3;
  private _maxHealth = 3;
  private _damageCooldown = 0;

  // Splash + Race
  private _splashEl: HTMLElement | null = null;
  private _race: Race | null = null;
  private _flashEl: HTMLElement;
  private _gyroBtn: HTMLElement;
  private _lastTapTime = 0;

  constructor(containerId: string) {
    initLang();
    tgInit();

    const container = document.querySelector<HTMLElement>(containerId);
    if (!container) throw new Error('Container not found');
    this._container = container;

    // Flash overlay for transitions
    this._flashEl = document.createElement('div');
    this._flashEl.className = 'flash';
    container.appendChild(this._flashEl);

    // World
    this._world = new World();

    // Check URL for shared game
    const urlData = new URLSearchParams(location.search).get('g');
    if (urlData) {
      const save = decodeFromURL(urlData);
      if (save) this._world.deserialize(save);
      else this._world.generateDefault();
    } else {
      const save = loadGame();
      if (save) this._world.deserialize(save);
      else this._world.generateDefault();
    }

    // Engine (hidden initially, used for play mode)
    this._engine = new Engine({
      container: container,
      voxelSize: 16,
      perspective: 700,
    });
    this._engine.renderer.root.style.display = 'none';

    this._mesh = new WorldMesh(16);
    this._engine.scene.add(this._mesh);

    // Game systems
    this._triggers = new TriggerRuntime();
    this._gyro = new GyroCamera();
    this._hud = new HUD();
    container.appendChild(this._hud.el);
    this._hud.el.style.display = 'none';
    this._hud.onJump = () => { this._jumpPressed = true; };
    this._hud.onShoot = () => { this._shootPressed = true; };

    this._engine.onUpdate((dt) => this._update(dt));
    this._engine.start();
    this._engine.pause();

    // Gyro toggle (visible in race + editor)
    this._gyroBtn = document.createElement('button');
    this._gyroBtn.className = 'gyro-btn off';
    this._gyroBtn.type = 'button';
    this._gyroBtn.setAttribute('aria-label', 'Gyro');
    this._gyroBtn.innerHTML = '<span class="gyro-icon"></span>';
    this._gyroBtn.addEventListener('click', () => this._onGyroToggle());
    container.appendChild(this._gyroBtn);

    // Double-tap anywhere = recalibrate gyro
    container.addEventListener('pointerdown', (e) => {
      const now = Date.now();
      if (now - this._lastTapTime < 400) {
        this._gyro.calibrate();
        this._lastTapTime = 0;
        tgHaptic('light');
      } else {
        this._lastTapTime = now;
      }
    });

    // If URL has game data, skip to play
    if (urlData) {
      this._initEditor();
      this.setMode('play');
    } else {
      this._showSplash();
    }

    tgBackButton(false);
  }

  private _initEditor() {
    if (this._editor) return;
    this._editor = new Editor(this._world, this._container);
    this._editor.onPlay = () => this.setMode('play');
    this._editor.onSave = () => this._save();
    this._editor.onShare = () => this._share();
    this._editor.setVisible(false);
  }

  // ── Splash ──

  private _showSplash() {
    this._mode = 'splash';
    this._container.className = 'mode-splash';

    this._splashEl = document.createElement('div');
    this._splashEl.className = 'splash';
    this._splashEl.innerHTML =
      '<div class="splash-title">PEEP</div>' +
      '<div class="splash-sub">wheelchair racer</div>' +
      '<button class="splash-start">START</button>';
    this._container.appendChild(this._splashEl);

    this._splashEl.querySelector('.splash-start')!.addEventListener('click', () => {
      playSound('click');
      this._startRace();
    });
  }

  // ── Race ──

  private _startRace() {
    if (this._splashEl) { this._splashEl.remove(); this._splashEl = null; }
    this._mode = 'race';
    this._container.className = 'mode-race';

    this._race = new Race(this._container, () => this._gyro.getSteer());
    this._race.onFinish = (won) => {
      this._flashEl.classList.add('on');
      const removeFlash = () => this._flashEl.classList.remove('on');
      // Guaranteed: remove white overlay 2.5s after flash (even if transition fails)
      setTimeout(removeFlash, 2500);
      setTimeout(() => {
        try {
          this._race?.destroy();
          this._race = null;
          this._mode = 'edit';
          this._container.className = 'mode-edit';
          this._initEditor();
          this._editor.setVisible(true);
          this._editor.refresh();
          this._hud.setDpadVisible(false);
          this._hud.showMessage('');
          this._hud.el.style.display = 'none';
          this._engine.camera.mode = 'orbit';
          this._engine.renderer.root.style.display = 'none';
          this._engine.pause();
          this._gyro.stop();
          tgBackButton(false);
          removeFlash();
        } catch (e) {
          removeFlash();
          this._mode = 'edit';
          this._container.className = 'mode-edit';
        }
      }, 800);
    };
    this._race.start();
  }

  // ── Mode switching ──

  setMode(mode: 'edit' | 'play') {
    this._mode = mode;
    this._container.className = mode === 'edit' ? 'mode-edit' : 'mode-play';

    if (mode === 'edit') {
      this._initEditor();
      this._editor.setVisible(true);
      this._editor.refresh();
      this._hud.setDpadVisible(false);
      this._hud.showMessage('');
      this._hud.el.style.display = 'none';
      this._player = null;
      this._engine.camera.mode = 'orbit';
      this._engine.renderer.root.style.display = 'none';
      this._engine.pause();
      this._gyro.stop();
      tgBackButton(false);
    } else {
      this._editor?.setVisible(false);
      this._hud.el.style.display = '';
      this._hud.setDpadVisible(true);
      this._hud.showMessage('');
      this._engine.renderer.root.style.display = '';
      this._engine.resume();
      this._player = new Player(this._world);
      this._triggers.reset();
      this._mesh.rebuildFromGrid(this._world.getGridForDisplay(true), this._world.palette, WORLD_SX, WORLD_SY, WORLD_SZ);
      this._health = this._maxHealth;
      this._damageCooldown = 0;
      this._engine.camera.mode = 'fly';
      this._engine.camera.state.rotationX = 0;
      this._engine.camera.state.rotationY = 0;
      const sp = this._world.findSpawn();
      this._engine.camera.state.position.set(sp[0] + 0.5, sp[1] + 1.5, sp[2] + 0.5);
      this._gyro.requestPermission().then(ok => { if (ok) this._gyro.start(); });
      tgBackButton(true, () => this.setMode('edit'));
    }
  }

  // ── Play mode update ──

  private _update(dt: number) {
    if (this._mode !== 'play') return;

    const p = this._player;
    if (!p) return;

    const keys = this._engine.input.state.keys;
    const dpad = this._hud.getMoveInput();
    let forward = dpad.forward, right = dpad.right;
    if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) right -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) right += 1;

    const jump = this._jumpPressed || keys.has('Space');
    this._jumpPressed = false;

    const { deltaX, deltaY, pinchDelta } = this._engine.input.state;
    if (deltaX) this._engine.camera.orbit(deltaX * 0.3, 0);
    if (deltaY) this._engine.camera.orbit(0, deltaY * 0.3);
    if (pinchDelta) this._engine.camera.zoom(pinchDelta * 2);
    this._engine.input.resetDeltas();

    p.state.yaw = this._engine.camera.state.rotationY * (Math.PI / 180);
    this._gyro.update(this._engine.camera);

    const sfx = p.move(forward, right, jump, dt);
    if (sfx) { playSound(sfx as any); tgHaptic(sfx === 'hit' ? 'heavy' : 'light'); }

    if (this._shootPressed) { this._shootPressed = false; this._shoot(); }

    const events = this._triggers.evaluate(this._world.triggers, p.state, this._world, dt);
    this._handleEvents(events);

    const cam = this._engine.camera.state;
    cam.position.x = p.state.x;
    cam.position.y = p.state.y + 1.5;
    cam.position.z = p.state.z;

    if (this._damageCooldown > 0) this._damageCooldown -= dt;
    if (!p.state.alive && this._health > 0 && this._damageCooldown <= 0) {
      this._health--;
      this._damageCooldown = 1.0;
      if (this._health > 0) { p.state.alive = true; playSound('hit'); tgHaptic('heavy'); }
    }

    this._hud.el.querySelector('.hud-top')!.innerHTML =
      `<span class="hud-score">${p.state.score}</span> &nbsp; ${'&#9829;'.repeat(this._health)}${'&#9825;'.repeat(this._maxHealth - this._health)}`;

    if (!p.state.alive && this._health <= 0) {
      this._hud.showMessage(`${t('you_died')} ${t('tap_retry')}`);
      this._waitForTap(() => { p.respawn(); this._health = this._maxHealth; this._hud.showMessage(''); this._mesh.rebuildFromGrid(this._world.getGridForDisplay(true), this._world.palette, WORLD_SX, WORLD_SY, WORLD_SZ); });
    } else if (p.state.won) {
      this._hud.showMessage(t('you_win'));
      this._waitForTap(() => this.setMode('edit'));
    }
  }

  private _shoot() {
    const p = this._player;
    if (!p) return;
    playSound('hit');
    tgHaptic('medium');
    const yaw = this._engine.camera.state.rotationY * (Math.PI / 180);
    const pitch = this._engine.camera.state.rotationX * (Math.PI / 180);
    const dx = -Math.sin(yaw) * Math.cos(pitch);
    const dy = Math.sin(pitch);
    const dz = Math.cos(yaw) * Math.cos(pitch);
    let rx = p.state.x, ry = p.state.y + 1.5, rz = p.state.z;
    for (let i = 0; i < 50; i++) {
      rx += dx * 0.3; ry += dy * 0.3; rz += dz * 0.3;
      const bx = Math.floor(rx), by = Math.floor(ry), bz = Math.floor(rz);
      if (this._world.isSolid(bx, by, bz)) {
        this._world.clear(bx, by, bz);
        this._mesh.rebuildFromGrid(this._world.getGridForDisplay(true), this._world.palette, WORLD_SX, WORLD_SY, WORLD_SZ);
        playSound('explode');
        return;
      }
    }
  }

  private _handleEvents(events: TriggerEvent[]) {
    for (const evt of events) {
      if (evt.type === 'text') this._hud.toast(evt.text, 3000);
      else if (evt.type === 'sound') playSound(evt.sound as any);
      else if (evt.type === 'win') playSound('win');
      else if (evt.type === 'lose') playSound('lose');
      else if (evt.type === 'teleport') playSound('pickup');
    }
    if (events.some(e => e.type === 'sound' && e.sound === 'explode'))
      this._mesh.rebuildFromGrid(this._world.getGridForDisplay(true), this._world.palette, WORLD_SX, WORLD_SY, WORLD_SZ);
  }

  private _waitForTap(cb: () => void) {
    const handler = () => { document.removeEventListener('pointerdown', handler); cb(); };
    setTimeout(() => document.addEventListener('pointerdown', handler), 500);
  }

  private async _onGyroToggle() {
    const on = await this._gyro.toggle();
    this._gyroBtn.classList.toggle('on', on);
    this._gyroBtn.classList.toggle('off', !on);
    tgHaptic('light');
  }

  private _save() {
    const ok = saveGame(this._world.serialize());
    this._hud.toast(ok ? t('saved') : t('save_fail'), 1500);
    playSound('pickup');
  }

  private _share() {
    const encoded = encodeForURL(this._world.serialize());
    const url = `${location.origin}${location.pathname}?g=${encoded}`;
    tgShare(url);
    this._hud.toast(t('link_copied'), 1500);
  }
}
