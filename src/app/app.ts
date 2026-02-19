import { Engine } from '../engine/engine';
import { WorldMesh } from '../engine/voxel';
import { World } from '../game/world';
import { Player } from '../game/player';
import { TriggerRuntime, type TriggerEvent } from '../game/triggers';
import { GyroCamera } from '../game/gyro';
import { HUD } from '../game/hud';
import { playSound } from '../game/sound';
import { Editor } from '../editor/editor';
import { saveGame, loadGame, loadGameTG, encodeForURL, decodeFromURL } from './storage';
import { tgInit, tgHaptic, tgShare, tgBackButton, isTG } from './tg';
import { initLang, t } from './i18n';

type AppMode = 'edit' | 'play';

export class App {
  private _container: HTMLElement;
  private _engine: Engine;
  private _world: World;
  private _mesh: WorldMesh;
  private _editor: Editor;
  private _player: Player | null = null;
  private _triggers: TriggerRuntime;
  private _gyro: GyroCamera;
  private _hud: HUD;
  private _mode: AppMode = 'edit';
  private _jumpPressed = false;
  private _shootPressed = false;
  private _health = 3;
  private _maxHealth = 3;
  private _damageCooldown = 0;

  constructor(containerId: string) {
    initLang();
    tgInit();

    const container = document.querySelector<HTMLElement>(containerId);
    if (!container) throw new Error('Container not found');
    this._container = container;

    // World
    this._world = new World();

    // Try loading saved game
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

    // Engine
    this._engine = new Engine({
      container: container,
      voxelSize: 16,
      perspective: 700,
    });

    // World mesh
    this._mesh = new WorldMesh(16);
    this._engine.scene.add(this._mesh);
    this._mesh.rebuildFromGrid(this._world.grid, this._world.palette);

    // Game systems
    this._triggers = new TriggerRuntime();
    this._gyro = new GyroCamera();
    this._hud = new HUD();
    container.appendChild(this._hud.el);

    // Editor
    this._editor = new Editor(this._world, container);
    this._editor.onPlay = () => this.setMode('play');
    this._editor.onSave = () => this._save();
    this._editor.onShare = () => this._share();

    // HUD callbacks
    this._hud.onJump = () => { this._jumpPressed = true; };
    this._hud.onShoot = () => { this._shootPressed = true; };

    // Keyboard input for play mode
    this._engine.onUpdate((dt) => this._update(dt));

    // Start
    this._engine.start();
    this.setMode(urlData ? 'play' : 'edit');

    // TG back button
    tgBackButton(false);
  }

  setMode(mode: AppMode) {
    this._mode = mode;
    this._container.className = mode === 'edit' ? 'mode-edit' : 'mode-play';

    if (mode === 'edit') {
      this._editor.setVisible(true);
      this._editor.refresh();
      this._hud.setDpadVisible(false);
      this._hud.showMessage('');
      this._hud.el.style.display = 'none';
      this._player = null;

      // Switch camera back to orbit for editor
      this._engine.camera.mode = 'orbit';
      this._engine.renderer.root.style.display = 'none';
      this._engine.pause();

      this._gyro.stop();
      tgBackButton(false);
    } else {
      this._editor.setVisible(false);
      this._hud.el.style.display = '';
      this._hud.setDpadVisible(true);
      this._hud.showMessage('');
      this._hud.setScore(0);

      // Show main renderer for play mode
      this._engine.renderer.root.style.display = '';
      this._engine.resume();

      this._player = new Player(this._world);
      this._triggers.reset();
      this._mesh.rebuildFromGrid(this._world.grid, this._world.palette);

      this._health = this._maxHealth;
      this._damageCooldown = 0;

      // FPS camera: first person
      this._engine.camera.mode = 'fly';
      this._engine.camera.state.rotationX = 0;
      this._engine.camera.state.rotationY = 0;
      const sp = this._world.findSpawn();
      this._engine.camera.state.position.set(sp[0] + 0.5, sp[1] + 1.5, sp[2] + 0.5);

      // Try enabling gyro
      this._gyro.requestPermission().then(ok => { if (ok) this._gyro.start(); });

      tgBackButton(true, () => this.setMode('edit'));
    }
  }

  private _update(dt: number) {
    if (this._mode === 'edit') {
      this._processEditInput();
      return;
    }

    // ── Play Mode ──
    const p = this._player;
    if (!p) return;

    // Input
    const keys = this._engine.input.state.keys;
    const dpad = this._hud.getMoveInput();
    let forward = dpad.forward;
    let right = dpad.right;

    if (keys.has('KeyW') || keys.has('ArrowUp'))    forward += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown'))  forward -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft'))   right -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight'))  right += 1;

    const jump = this._jumpPressed || keys.has('Space');
    this._jumpPressed = false;

    // Camera drag -> player yaw
    const { deltaX, deltaY, pinchDelta } = this._engine.input.state;
    if (deltaX) this._engine.camera.orbit(deltaX * 0.3, 0);
    if (deltaY) this._engine.camera.orbit(0, deltaY * 0.3);
    if (pinchDelta) this._engine.camera.zoom(pinchDelta * 2);
    this._engine.input.resetDeltas();

    // FPS: camera yaw drives player direction
    p.state.yaw = this._engine.camera.state.rotationY * (Math.PI / 180);

    // Gyroscope
    this._gyro.update(this._engine.camera);

    // Player physics
    const sfx = p.move(forward, right, jump, dt);
    if (sfx) {
      playSound(sfx as any);
      tgHaptic(sfx === 'hit' ? 'heavy' : 'light');
    }

    // Shooting
    if (this._shootPressed) {
      this._shootPressed = false;
      this._shoot();
    }

    // Triggers
    const events = this._triggers.evaluate(
      this._world.triggers, p.state, this._world, dt,
    );
    this._handleEvents(events);

    // FPS camera: position = player eyes
    const cam = this._engine.camera.state;
    cam.position.x = p.state.x;
    cam.position.y = p.state.y + 1.5;
    cam.position.z = p.state.z;

    // Damage cooldown
    if (this._damageCooldown > 0) this._damageCooldown -= dt;

    // Health-based damage (instead of instant death)
    if (!p.state.alive && this._health > 0 && this._damageCooldown <= 0) {
      this._health--;
      this._damageCooldown = 1.0;
      if (this._health > 0) {
        p.state.alive = true;
        playSound('hit');
        tgHaptic('heavy');
      }
    }

    // HUD
    this._hud.setScore(p.state.score);
    this._hud.el.querySelector('.hud-top')!.innerHTML =
      `<span class="hud-score">${p.state.score}</span> &nbsp; ${'&#9829;'.repeat(this._health)}${'&#9825;'.repeat(this._maxHealth - this._health)}`;

    // Death / Win
    if (!p.state.alive && this._health <= 0) {
      this._hud.showMessage(`${t('you_died')} ${t('tap_retry')}`);
      this._waitForTap(() => {
        p.respawn();
        this._hud.showMessage('');
        this._mesh.rebuildFromGrid(this._world.grid, this._world.palette);
      });
    } else if (p.state.won) {
      this._hud.showMessage(t('you_win'));
      this._waitForTap(() => this.setMode('edit'));
    }
  }

  /** Raycast from player eyes forward, destroy first block hit */
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
        this._mesh.rebuildFromGrid(this._world.grid, this._world.palette);
        playSound('explode');
        return;
      }
    }
  }

  private _processEditInput() {
    this._engine.input.resetDeltas();
  }

  private _handleEvents(events: TriggerEvent[]) {
    for (const evt of events) {
      switch (evt.type) {
        case 'text':
          this._hud.toast(evt.text, 3000);
          break;
        case 'sound':
          playSound(evt.sound as any);
          break;
        case 'win':
          playSound('win');
          break;
        case 'lose':
          playSound('lose');
          break;
        case 'teleport':
          playSound('pickup');
          break;
      }
    }
    // If triggers modified the world, rebuild mesh
    if (events.some(e => e.type === 'sound' && e.sound === 'explode')) {
      this._mesh.rebuildFromGrid(this._world.grid, this._world.palette);
    }
  }

  private _waitForTap(cb: () => void) {
    const handler = () => {
      document.removeEventListener('pointerdown', handler);
      cb();
    };
    setTimeout(() => document.addEventListener('pointerdown', handler), 500);
  }

  private _save() {
    const save = this._world.serialize();
    const ok = saveGame(save);
    this._hud.toast(ok ? t('saved') : t('save_fail'), 1500);
    playSound('pickup');
  }

  private _share() {
    const save = this._world.serialize();
    const encoded = encodeForURL(save);
    const url = `${location.origin}${location.pathname}?g=${encoded}`;
    tgShare(url);
    this._hud.toast(t('link_copied'), 1500);
  }
}
