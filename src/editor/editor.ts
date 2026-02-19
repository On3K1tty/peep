import { Camera, Renderer } from '../engine/renderer';
import { WorldMesh } from '../engine/voxel';
import { World } from '../game/world';
import { LayerGrid } from './layer-grid';
import { Palette } from './palette';
import { TriggerEditor } from './trigger-ui';
import { playSound } from '../game/sound';
import { t, getLangs, setLang, getLang } from '../app/i18n';

type EditorTool = 'draw' | 'erase' | 'pick' | 'role';

interface UndoEntry {
  x: number; y: number; z: number;
  oldBlock: number; oldRole: number;
  newBlock: number; newRole: number;
}

export class Editor {
  readonly toolbar: HTMLElement;
  readonly layerGrid: LayerGrid;
  readonly palette: Palette;
  readonly triggerEditor: TriggerEditor;

  private _world: World;
  private _tool: EditorTool = 'draw';

  // 3D preview
  private _previewWrap: HTMLElement;
  private _previewRenderer: Renderer;
  private _previewMesh: WorldMesh;
  private _previewCam: Camera;
  private _previewAngle = 35;

  // Undo/Redo
  private _undoStack: UndoEntry[] = [];
  private _redoStack: UndoEntry[] = [];
  private _undoBtn!: HTMLElement;
  private _redoBtn!: HTMLElement;
  private _sidePanel!: HTMLElement;

  // Swap state
  private _swapped = false;
  private _swapBtn!: HTMLElement;

  onPlay?: () => void;
  onSave?: () => void;
  onShare?: () => void;

  constructor(world: World, container: HTMLElement) {
    this._world = world;

    // ── Undo/Redo side panel (left) ──
    this._sidePanel = document.createElement('div');
    this._sidePanel.className = 'side-panel edit-only';
    this._sidePanel.innerHTML =
      '<button class="sp-btn sp-undo" title="Undo">&#8630;</button>' +
      '<button class="sp-btn sp-redo" title="Redo">&#8631;</button>';
    container.appendChild(this._sidePanel);
    this._undoBtn = this._sidePanel.querySelector('.sp-undo')!;
    this._redoBtn = this._sidePanel.querySelector('.sp-redo')!;
    this._undoBtn.addEventListener('click', () => this._undo());
    this._redoBtn.addEventListener('click', () => this._redo());

    // ── 3D Preview (small, top-right) ──
    this._previewWrap = document.createElement('div');
    this._previewWrap.className = 'preview-3d edit-only';
    container.appendChild(this._previewWrap);

    this._previewCam = new Camera('orbit');
    this._previewCam.state.distance = 40;
    this._previewCam.state.rotationX = -30;
    this._previewCam.state.rotationY = 35;
    this._previewCam.state.target.set(16, 6, 16);
    this._previewRenderer = new Renderer(this._previewWrap, this._previewCam, 300, 4);
    this._previewMesh = new WorldMesh(4);
    this._previewRenderer.world.appendChild(this._previewMesh.el);
    this._previewMesh.el.style.transformStyle = 'preserve-3d';

    // Preview rotation: auto + drag + gyro
    let dragging = false;
    let lastX = 0, lastY = 0;
    this._previewWrap.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    this._previewWrap.addEventListener('touchstart', (e) => { dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; }, { passive: true });
    window.addEventListener('mousemove', (e) => { if (!dragging) return; this._previewCam.orbit((e.clientX - lastX) * 0.5, (e.clientY - lastY) * 0.5); lastX = e.clientX; lastY = e.clientY; this._previewAngle = this._previewCam.state.rotationY; });
    window.addEventListener('touchmove', (e) => { if (!dragging) return; this._previewCam.orbit((e.touches[0].clientX - lastX) * 0.5, (e.touches[0].clientY - lastY) * 0.5); lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; this._previewAngle = this._previewCam.state.rotationY; });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('touchend', () => { dragging = false; });
    this._previewWrap.addEventListener('wheel', (e) => { e.preventDefault(); this._previewCam.zoom(e.deltaY * 0.02); }, { passive: false });

    // Gyro on preview
    const setupGyro = async () => {
      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE.requestPermission === 'function') {
        try { await DOE.requestPermission(); } catch { return; }
      }
      let baseA = 0, baseB = 0, first = true;
      window.addEventListener('deviceorientation', (e) => {
        if (e.alpha == null || e.beta == null) return;
        if (first) { baseA = e.alpha; baseB = e.beta; first = false; }
        if (!dragging) {
          const ya = (e.alpha - baseA) * 0.3;
          const pi = (e.beta - baseB) * 0.3;
          this._previewCam.state.rotationY += (ya - this._previewCam.state.rotationY) * 0.08;
          this._previewCam.state.rotationX += (Math.max(-89, Math.min(89, pi)) - this._previewCam.state.rotationX) * 0.08;
          this._previewAngle = this._previewCam.state.rotationY;
        }
      });
    };
    setupGyro();

    const rotatePreview = () => {
      if (!dragging) { this._previewAngle += 0.08; this._previewCam.state.rotationY = this._previewAngle; }
      this._previewRenderer.render();
      requestAnimationFrame(rotatePreview);
    };
    requestAnimationFrame(rotatePreview);

    // Swap button on the preview
    this._swapBtn = document.createElement('button');
    this._swapBtn.className = 'swap-btn';
    this._swapBtn.innerHTML = '&#8644;';
    this._swapBtn.title = 'Swap views';
    this._previewWrap.appendChild(this._swapBtn);
    this._swapBtn.addEventListener('click', () => this._toggleSwap());

    // ── Layer grid editor (main workspace) ──
    this.layerGrid = new LayerGrid(world);
    this.layerGrid.onCellTap = (x, z, layer) => this._onCellTap(x, z, layer);
    container.appendChild(this.layerGrid.el);

    // ── Palette ──
    this.palette = new Palette(world.palette);
    container.appendChild(this.palette.el);
    container.appendChild(this.palette.roleBar);

    // ── Trigger editor ──
    this.triggerEditor = new TriggerEditor();
    this.triggerEditor.onChange = (triggers) => { world.triggers = triggers; };
    this.triggerEditor.load(world.triggers);
    container.appendChild(this.triggerEditor.el);

    // ── Toolbar ──
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'toolbar edit-only';
    this._rebuildToolbar();
    container.appendChild(this.toolbar);

    this._bindToolbar();
    this._refreshPreview();
    this._updateUndoButtons();
  }

  private _rebuildToolbar() {
    this.toolbar.innerHTML =
      `<button class="tb-draw active" data-tool="draw">${t('draw')}</button>` +
      `<button class="tb-erase" data-tool="erase">${t('erase')}</button>` +
      `<button class="tb-role" data-tool="role">${t('role')}</button>` +
      `<button class="tb-triggers">${t('triggers')}</button>` +
      `<select class="tb-lang"></select>` +
      `<div class="tb-spacer"></div>` +
      `<button class="tb-play">${t('play')}</button>` +
      `<button class="tb-save">${t('save')}</button>` +
      `<button class="tb-share">${t('share')}</button>`;

    const langSelect = this.toolbar.querySelector('.tb-lang') as HTMLSelectElement;
    for (const { code, name } of getLangs()) {
      const opt = document.createElement('option');
      opt.value = code; opt.textContent = name;
      if (code === getLang()) opt.selected = true;
      langSelect.appendChild(opt);
    }
    langSelect.addEventListener('change', () => {
      setLang(langSelect.value);
      this._rebuildToolbar();
      this._bindToolbar();
      this.layerGrid.updateLabel();
    });
  }

  private _bindToolbar() {
    this.toolbar.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;

      const tool = btn.dataset.tool as EditorTool | undefined;
      if (tool) {
        this._tool = tool;
        this.toolbar.querySelectorAll('[data-tool]').forEach(b =>
          b.classList.toggle('active', b === btn));
        this.palette.showRoles(tool === 'role');
        return;
      }

      if (btn.classList.contains('tb-triggers')) this.triggerEditor.show();
      else if (btn.classList.contains('tb-play')) this.onPlay?.();
      else if (btn.classList.contains('tb-save')) this.onSave?.();
      else if (btn.classList.contains('tb-share')) this.onShare?.();
    });
  }

  private _onCellTap(x: number, z: number, layer: number) {
    const w = this._world;
    const oldBlock = w.get(x, layer, z);
    const oldRole = w.getRole(x, layer, z);

    switch (this._tool) {
      case 'draw': {
        const nb = this.palette.selectedColor;
        const nr = this.palette.selectedRole;
        if (oldBlock === nb && oldRole === nr) return;
        w.set(x, layer, z, nb, nr);
        this._pushUndo(x, layer, z, oldBlock, oldRole, nb, nr);
        playSound('place');
        break;
      }
      case 'erase': {
        if (oldBlock === 0) return;
        w.clear(x, layer, z);
        this._pushUndo(x, layer, z, oldBlock, oldRole, 0, 0);
        playSound('click');
        break;
      }
      case 'role': {
        if (oldBlock === 0) return;
        const nr = this.palette.selectedRole;
        if (oldRole === nr) return;
        w.set(x, layer, z, oldBlock, nr);
        this._pushUndo(x, layer, z, oldBlock, oldRole, oldBlock, nr);
        playSound('click');
        break;
      }
      case 'pick':
        if (oldBlock > 0) playSound('click');
        break;
    }
    this.layerGrid.draw();
    this._refreshPreview();
  }

  // ── Undo / Redo ──

  private _pushUndo(x: number, y: number, z: number, ob: number, or2: number, nb: number, nr: number) {
    this._undoStack.push({ x, y, z, oldBlock: ob, oldRole: or2, newBlock: nb, newRole: nr });
    if (this._undoStack.length > 200) this._undoStack.shift();
    this._redoStack.length = 0;
    this._updateUndoButtons();
  }

  private _undo() {
    const entry = this._undoStack.pop();
    if (!entry) return;
    this._world.set(entry.x, entry.y, entry.z, entry.oldBlock, entry.oldRole);
    this._redoStack.push(entry);
    this.layerGrid.draw();
    this._refreshPreview();
    this._updateUndoButtons();
    playSound('click');
  }

  private _redo() {
    const entry = this._redoStack.pop();
    if (!entry) return;
    this._world.set(entry.x, entry.y, entry.z, entry.newBlock, entry.newRole);
    this._undoStack.push(entry);
    this.layerGrid.draw();
    this._refreshPreview();
    this._updateUndoButtons();
    playSound('click');
  }

  private _updateUndoButtons() {
    this._undoBtn.classList.toggle('disabled', this._undoStack.length === 0);
    this._redoBtn.classList.toggle('disabled', this._redoStack.length === 0);
  }

  // ── Swap views ──

  private _toggleSwap() {
    this._swapped = !this._swapped;
    this._previewWrap.classList.toggle('swapped', this._swapped);
    this.layerGrid.el.classList.toggle('swapped', this._swapped);
  }

  // ── Preview ──

  private _refreshPreview() {
    this._previewMesh.rebuildFromGrid(this._world.grid, this._world.palette);
  }

  refresh() {
    this.layerGrid.draw();
    this._refreshPreview();
    this.triggerEditor.load(this._world.triggers);
  }

  setVisible(v: boolean) {
    const display = v ? '' : 'none';
    this.layerGrid.el.style.display = display;
    this.palette.el.style.display = display;
    this.palette.roleBar.style.display = 'none';
    this.toolbar.style.display = v ? 'flex' : 'none';
    this._previewWrap.style.display = display;
    this._sidePanel.style.display = v ? 'flex' : 'none';
    if (v) this.triggerEditor.hide();
  }

  destroy() {
    this.layerGrid.destroy();
    this.palette.destroy();
    this.triggerEditor.destroy();
    this.toolbar.remove();
    this._previewWrap.remove();
    this._previewRenderer.destroy();
    this._sidePanel.remove();
  }
}
