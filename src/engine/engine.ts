import { Renderer, Camera } from './renderer';
import { InputManager } from './input';
import { perfTick } from './perf';
import type { EngineOptions, SceneNode } from './types';

export class Scene {
  private _nodes: SceneNode[] = [];
  private _worldEl: HTMLElement;

  constructor(worldEl: HTMLElement) {
    this._worldEl = worldEl;
  }

  add(node: SceneNode) {
    this._nodes.push(node);
    this._worldEl.appendChild(node.el);
    node.update();
  }

  remove(node: SceneNode) {
    const idx = this._nodes.indexOf(node);
    if (idx >= 0) this._nodes.splice(idx, 1);
    node.destroy();
  }

  clear() {
    for (const node of this._nodes) node.destroy();
    this._nodes.length = 0;
  }

  update() {
    for (const node of this._nodes) node.update();
  }

  get nodes(): readonly SceneNode[] {
    return this._nodes;
  }
}

export class Engine {
  readonly renderer: Renderer;
  readonly camera: Camera;
  readonly scene: Scene;
  readonly input: InputManager;

  private _running = false;
  private _paused = false;
  private _rafId = 0;
  private _lastTime = 0;
  private _updateCbs: ((dt: number) => void)[] = [];

  constructor(opts: EngineOptions) {
    const container = typeof opts.container === 'string'
      ? document.querySelector<HTMLElement>(opts.container)
      : opts.container;
    if (!container) throw new Error('VoxelDOM: container not found');

    this.camera = new Camera('orbit');
    this.renderer = new Renderer(
      container,
      this.camera,
      opts.perspective ?? 800,
      opts.voxelSize ?? 16,
    );

    this.scene = new Scene(this.renderer.world);
    this.input = new InputManager(this.renderer.root);
  }

  get voxelSize() { return this.renderer.voxelSize; }
  get running() { return this._running; }
  get paused() { return this._paused; }

  onUpdate(cb: (dt: number) => void) { this._updateCbs.push(cb); }
  clearCallbacks() { this._updateCbs.length = 0; }

  onVoxelClick(cb: (e: { x: number; y: number; z: number; normal: string }) => void) {
    this.input.onVoxelClick(cb);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._paused = false;
    this._lastTime = performance.now();
    this._tick(this._lastTime);
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._rafId);
  }

  pause() { this._paused = true; }
  resume() { this._paused = false; this._lastTime = performance.now(); }

  destroy() {
    this.stop();
    this.scene.clear();
    this.input.destroy();
    this.renderer.destroy();
  }

  private _tick = (now: number) => {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(this._tick);

    if (this._paused) { this._lastTime = now; return; }

    const dt = Math.min((now - this._lastTime) / 1000, 0.1);
    this._lastTime = now;

    for (const cb of this._updateCbs) cb(dt);
    this.scene.update();
    this.renderer.render();
    perfTick();
    this.input.resetDeltas();
  };
}
