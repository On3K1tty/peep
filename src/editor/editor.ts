import { Camera, Renderer } from '../engine/renderer';
import { WorldMesh } from '../engine/voxel';
import { World, WORLD_SX, WORLD_SY, WORLD_SZ } from '../game/world';
import type { GyroCamera } from '../game/gyro';
import { Palette } from './palette';
import { LayerGrid } from './layer-grid';
import { TriggerEditor } from './trigger-ui';
import { StampPanel } from './stamp-panel';
import { playSound } from '../game/sound';
import { t, getLangs, setLang, getLang, getFlag } from '../app/i18n';

type EditorTool = 'draw' | 'erase' | 'role' | 'stamp';

interface UndoEntry {
  x: number; y: number; z: number;
  oldBlock: number; oldRole: number;
  newBlock: number; newRole: number;
}

const NORMAL_OFFSETS: Record<string, [number, number, number]> = {
  top: [0, 1, 0], bottom: [0, -1, 0],
  front: [0, 0, 1], back: [0, 0, -1],
  right: [1, 0, 0], left: [-1, 0, 0],
};

export class Editor {
  readonly toolbar: HTMLElement;
  readonly palette: Palette;
  readonly layerGrid: LayerGrid;
  readonly triggerEditor: TriggerEditor;
  readonly stampPanel: StampPanel;

  private _world: World;
  private _tool: EditorTool = 'draw';

  // 3D editor view (full screen)
  private _editorWrap: HTMLElement;
  private _renderer: Renderer;
  private _mesh: WorldMesh;
  private _cam: Camera;

  // Undo/Redo
  private _undoStack: UndoEntry[] = [];
  private _redoStack: UndoEntry[] = [];
  private _undoBtn!: HTMLElement;
  private _redoBtn!: HTMLElement;
  private _sidePanel!: HTMLElement;

  // Drag state for orbit vs click detection
  private _dragDist = 0;
  private _longPressTimer = 0;
  private _gyro?: GyroCamera;
  private _joystickPanel!: HTMLElement;
  private _stickForward = 0;
  private _stickRight = 0;
  private _editorZoomDelta = 0;

  onPlay?: () => void;
  onSave?: () => void;
  onShare?: () => void;

  constructor(world: World, container: HTMLElement, gyro?: GyroCamera) {
    this._world = world;
    this._gyro = gyro;

    // Undo/Redo
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

    // 3D Editor (full screen)
    this._editorWrap = document.createElement('div');
    this._editorWrap.className = 'editor-3d edit-only';
    container.appendChild(this._editorWrap);

    this._cam = new Camera('orbit');
    this._cam.state.distance = 80;
    this._cam.state.rotationX = -30;
    this._cam.state.rotationY = 35;
    this._cam.state.target.set(WORLD_SX / 2, WORLD_SY / 4, WORLD_SZ / 2);
    this._renderer = new Renderer(this._editorWrap, this._cam, 700, 8);
    this._mesh = new WorldMesh(8);
    this._renderer.world.appendChild(this._mesh.el);
    this._mesh.el.style.transformStyle = 'preserve-3d';

    this._bindEditorInput();

    // Palette (sync selection to layer grid)
    this.palette = new Palette(world.palette);
    container.appendChild(this.palette.el);
    container.appendChild(this.palette.roleBar);

    // Layer-by-layer 2D editor (plan: main editor)
    this.layerGrid = new LayerGrid(world);
    this.layerGrid.setSelectedColor(this.palette.selectedColor);
    this.layerGrid.setSelectedRole(this.palette.selectedRole);
    this.layerGrid.onChange = () => {
      this._refreshMesh();
      playSound('place');
    };
    this.palette.onChange = (colorIndex, role) => {
      this.layerGrid.setSelectedColor(colorIndex);
      this.layerGrid.setSelectedRole(role);
    };
    container.appendChild(this.layerGrid.el);

    this._buildEditorJoystick(container);

    const ORBIT_SPEED = 1.2;
    const ZOOM_SPEED = 2;
    let lastRx = this._cam.state.rotationX, lastRy = this._cam.state.rotationY, lastDist = this._cam.state.distance;
    const renderLoop = () => {
      if (this._gyro?.enabled) {
        this._gyro.update(this._cam);
        this._joystickPanel.style.display = 'none';
      } else {
        this._joystickPanel.style.display = 'flex';
        if (this._stickForward || this._stickRight) this._cam.orbit(this._stickRight * ORBIT_SPEED, this._stickForward * ORBIT_SPEED);
        if (this._editorZoomDelta) this._cam.zoom(this._editorZoomDelta * ZOOM_SPEED);
        this._editorZoomDelta = 0;
      }
      const rx = this._cam.state.rotationX, ry = this._cam.state.rotationY, d = this._cam.state.distance;
      if (rx !== lastRx || ry !== lastRy || d !== lastDist) {
        lastRx = rx; lastRy = ry; lastDist = d;
        this._renderer.render();
      }
      requestAnimationFrame(renderLoop);
    };
    requestAnimationFrame(renderLoop);

    // Trigger editor
    this.triggerEditor = new TriggerEditor();
    this.triggerEditor.onChange = (triggers) => { world.triggers = triggers; };
    this.triggerEditor.load(world.triggers);
    container.appendChild(this.triggerEditor.el);

    // Stamp panel (модели: дерево, дом, человек, животное, ландшафт)
    this.stampPanel = new StampPanel(world);
    container.appendChild(this.stampPanel.el);

    // Toolbar
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'toolbar edit-only';
    this._rebuildToolbar();
    container.appendChild(this.toolbar);
    this._bindToolbar();

    this._refreshMesh();
    this._updateUndoButtons();
  }

  private _buildEditorJoystick(container: HTMLElement) {
    const panel = document.createElement('div');
    panel.className = 'editor-joystick edit-only';
    panel.style.display = 'none';
    panel.innerHTML =
      '<div class="ej-dpad">' +
        '<button class="ej-dp ej-u" data-d="u" type="button">&#9650;</button>' +
        '<button class="ej-dp ej-l" data-d="l" type="button">&#9664;</button>' +
        '<button class="ej-dp ej-r" data-d="r" type="button">&#9654;</button>' +
        '<button class="ej-dp ej-d" data-d="d" type="button">&#9660;</button>' +
      '</div>' +
      '<div class="ej-zoom">' +
        '<button class="ej-z ej-in" type="button">+</button>' +
        '<button class="ej-z ej-out" type="button">−</button>' +
      '</div>';

    const setStick = (d: string, down: boolean) => {
      if (d === 'u') this._stickForward = down ? 1 : 0;
      else if (d === 'd') this._stickForward = down ? -1 : 0;
      else if (d === 'l') this._stickRight = down ? -1 : 0;
      else this._stickRight = down ? 1 : 0;
    };
    const clearAxis = (d: string) => {
      if (d === 'u' || d === 'd') this._stickForward = 0;
      else this._stickRight = 0;
    };
    panel.querySelectorAll('.ej-dp').forEach((btn) => {
      const d = (btn as HTMLElement).dataset.d!;
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); setStick(d, true); }, { passive: false });
      btn.addEventListener('touchend', () => clearAxis(d));
      btn.addEventListener('mousedown', (e) => { e.preventDefault(); setStick(d, true); });
      btn.addEventListener('mouseup', () => clearAxis(d));
      btn.addEventListener('mouseleave', () => clearAxis(d));
    });
    panel.querySelector('.ej-in')!.addEventListener('click', (e) => { e.preventDefault(); this._editorZoomDelta += 1; });
    panel.querySelector('.ej-out')!.addEventListener('click', (e) => { e.preventDefault(); this._editorZoomDelta -= 1; });
    panel.querySelector('.ej-in')!.addEventListener('touchstart', (e) => { e.preventDefault(); this._editorZoomDelta += 1; }, { passive: false });
    panel.querySelector('.ej-out')!.addEventListener('touchstart', (e) => { e.preventDefault(); this._editorZoomDelta -= 1; }, { passive: false });

    container.appendChild(panel);
    this._joystickPanel = panel;
  }

  private _bindEditorInput() {
    let dragging = false;
    let lastX = 0, lastY = 0;
    let startTarget: HTMLElement | null = null;

    const onDown = (x: number, y: number, target: HTMLElement) => {
      dragging = true; lastX = x; lastY = y; this._dragDist = 0;
      startTarget = target;
      this._longPressTimer = window.setTimeout(() => {
        if (this._dragDist < 5) this._handleErase(startTarget!);
        startTarget = null;
      }, 500);
    };
    const onMove = (x: number, y: number) => {
      if (!dragging) return;
      const dx = x - lastX, dy = y - lastY;
      this._dragDist += Math.abs(dx) + Math.abs(dy);
      this._cam.orbit(dx * 0.4, dy * 0.4);
      lastX = x; lastY = y;
    };
    const onUp = () => {
      clearTimeout(this._longPressTimer);
      if (dragging && this._dragDist < 5 && startTarget) {
        this._handleClick(startTarget);
      }
      dragging = false; startTarget = null;
    };

    this._editorWrap.addEventListener('mousedown', (e) => onDown(e.clientX, e.clientY, e.target as HTMLElement));
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', () => onUp());

    this._editorWrap.addEventListener('touchstart', (e) => {
      e.preventDefault();
      onDown(e.touches[0].clientX, e.touches[0].clientY, e.target as HTMLElement);
    }, { passive: false });
    this._editorWrap.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    this._editorWrap.addEventListener('touchend', () => onUp());

    this._editorWrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._cam.zoom(e.deltaY * 0.02);
    }, { passive: false });

    // Right-click = erase
    this._editorWrap.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._handleErase(e.target as HTMLElement);
    });
  }

  private _handleClick(target: HTMLElement) {
    if (!target.dataset.n) return;

    if (this._tool === 'stamp' && this.stampPanel.selected) {
      const n = target.dataset.n!;
      const bx = +target.dataset.x!, by = +target.dataset.y!, bz = +target.dataset.z!;
      const off = NORMAL_OFFSETS[n];
      if (!off) return;
      const nx = bx + off[0], ny = by + off[1], nz = bz + off[2];
      if (nx < 0 || nx >= WORLD_SX || ny < 0 || ny >= WORLD_SY || nz < 0 || nz >= WORLD_SZ) return;
      const placed = this.stampPanel.placeAt(nx, ny, nz);
      if (placed) {
        this._refreshMesh();
        playSound('place');
      }
      return;
    }

    if (this._tool === 'erase') {
      this._handleErase(target);
      return;
    }

    if (this._tool === 'role') {
      const bx = +target.dataset.x!, by = +target.dataset.y!, bz = +target.dataset.z!;
      const oldBlock = this._world.get(bx, by, bz);
      if (oldBlock === 0) return;
      const oldRole = this._world.getRole(bx, by, bz);
      const nr = this.palette.selectedRole;
      if (oldRole === nr) return;
      this._world.set(bx, by, bz, oldBlock, nr);
      this._pushUndo(bx, by, bz, oldBlock, oldRole, oldBlock, nr);
      this._refreshMesh();
      playSound('click');
      return;
    }

    // Draw: place block adjacent to clicked face
    const n = target.dataset.n!;
    const bx = +target.dataset.x!, by = +target.dataset.y!, bz = +target.dataset.z!;
    const off = NORMAL_OFFSETS[n];
    if (!off) return;
    const nx = bx + off[0], ny = by + off[1], nz = bz + off[2];

    if (nx < 0 || nx >= WORLD_SX || ny < 0 || ny >= WORLD_SY || nz < 0 || nz >= WORLD_SZ) return;
    if (this._world.get(nx, ny, nz) !== 0) return;

    const color = this.palette.selectedColor;
    const role = this.palette.selectedRole;
    this._world.set(nx, ny, nz, color, role);
    this._pushUndo(nx, ny, nz, 0, 0, color, role);
    this._refreshMesh();
    playSound('place');
  }

  private _handleErase(target: HTMLElement) {
    if (!target.dataset.n) return;
    const bx = +target.dataset.x!, by = +target.dataset.y!, bz = +target.dataset.z!;
    const oldBlock = this._world.get(bx, by, bz);
    const oldRole = this._world.getRole(bx, by, bz);
    if (oldBlock === 0) return;
    this._world.clear(bx, by, bz);
    this._pushUndo(bx, by, bz, oldBlock, oldRole, 0, 0);
    this._refreshMesh();
    playSound('click');
  }

  // Undo / Redo

  private _pushUndo(x: number, y: number, z: number, ob: number, or2: number, nb: number, nr: number) {
    this._undoStack.push({ x, y, z, oldBlock: ob, oldRole: or2, newBlock: nb, newRole: nr });
    if (this._undoStack.length > 200) this._undoStack.shift();
    this._redoStack.length = 0;
    this._updateUndoButtons();
  }

  private _undo() {
    const e = this._undoStack.pop();
    if (!e) return;
    this._world.set(e.x, e.y, e.z, e.oldBlock, e.oldRole);
    this._redoStack.push(e);
    this._refreshMesh();
    this._updateUndoButtons();
    playSound('click');
  }

  private _redo() {
    const e = this._redoStack.pop();
    if (!e) return;
    this._world.set(e.x, e.y, e.z, e.newBlock, e.newRole);
    this._undoStack.push(e);
    this._refreshMesh();
    this._updateUndoButtons();
    playSound('click');
  }

  private _updateUndoButtons() {
    this._undoBtn.classList.toggle('disabled', this._undoStack.length === 0);
    this._redoBtn.classList.toggle('disabled', this._redoStack.length === 0);
  }

  // Toolbar (inline SVG icons, no text)

  private static _iconPencil = '<svg class="tb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 15.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>';
  private static _iconEraser = '<svg class="tb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20H7L3 16a2 2 0 010-2.83L16 3a2 2 0 012.83 0l2.83 2.83a2 2 0 010 2.83L10 20"/><path d="M18 13l-4-4"/><path d="M14 17l-4-4"/></svg>';
  private static _iconGear = '<svg class="tb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
  private static _iconLightning = '<svg class="tb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
  private static _iconPlay = '<svg class="tb-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  private static _iconFloppy = '<svg class="tb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>';
  private static _iconShare = '<svg class="tb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.82 3.98M15.41 6.51l-6.82 3.98"/></svg>';
  private static _iconStamp = '<svg class="tb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';

  private _rebuildToolbar() {
    this.toolbar.innerHTML =
      `<button class="tb-btn active" data-tool="draw" title="${t('draw')}">${Editor._iconPencil}</button>` +
      `<button class="tb-btn" data-tool="erase" title="${t('erase')}">${Editor._iconEraser}</button>` +
      `<button class="tb-btn" data-tool="role" title="${t('role')}">${Editor._iconGear}</button>` +
      `<button class="tb-btn" data-tool="stamp" title="Штампы">${Editor._iconStamp}</button>` +
      `<button class="tb-btn tb-triggers" title="${t('triggers')}">${Editor._iconLightning}</button>` +
      `<button class="tb-btn tb-lang" title="${t('language')}" type="button">${getFlag(getLang())}</button>` +
      `<div class="tb-spacer"></div>` +
      `<button class="tb-btn tb-play" title="${t('play')}">${Editor._iconPlay}</button>` +
      `<button class="tb-btn tb-save" title="${t('save')}">${Editor._iconFloppy}</button>` +
      `<button class="tb-btn tb-share" title="${t('share')}">${Editor._iconShare}</button>`;

    const langBtn = this.toolbar.querySelector('.tb-lang')!;
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._showFlagPicker(langBtn as HTMLElement);
    });
  }

  private _showFlagPicker(anchor: HTMLElement) {
    const existing = document.querySelector('.flag-picker');
    if (existing) { existing.remove(); return; }
    const wrap = document.createElement('div');
    wrap.className = 'flag-picker';
    const grid = document.createElement('div');
    grid.className = 'flag-picker-grid';
    for (const { code, name, flag } of getLangs()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'flag-picker-btn';
      btn.textContent = flag;
      btn.title = name;
      if (code === getLang()) btn.classList.add('active');
      btn.addEventListener('click', () => {
        setLang(code);
        (this.toolbar.querySelector('.tb-lang') as HTMLElement).textContent = getFlag(code);
        wrap.remove();
        this._rebuildToolbar();
        this._bindToolbar();
        playSound('click');
      });
      grid.appendChild(btn);
    }
    wrap.appendChild(grid);
    const close = () => { wrap.remove(); document.removeEventListener('click', close); };
    document.body.appendChild(wrap);
    requestAnimationFrame(() => document.addEventListener('click', close));
  }

  private _bindToolbar() {
    this.toolbar.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;
      const tool = btn.dataset.tool as EditorTool | undefined;
      if (tool) {
        this._tool = tool;
        this.toolbar.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b === btn));
        this.palette.showRoles(tool === 'role');
        this.stampPanel.show(tool === 'stamp');
        if (tool !== 'stamp') this.stampPanel.clearSelection();
        return;
      }
      if (btn.classList.contains('tb-triggers')) this.triggerEditor.show();
      else if (btn.classList.contains('tb-play')) this.onPlay?.();
      else if (btn.classList.contains('tb-save')) this.onSave?.();
      else if (btn.classList.contains('tb-share')) this.onShare?.();
    });
  }

  private _refreshMesh() {
    this._mesh.rebuildFromGrid(this._world.grid, this._world.palette, WORLD_SX, WORLD_SY, WORLD_SZ);
  }

  refresh() {
    this._refreshMesh();
    this.layerGrid.refresh();
    this.triggerEditor.load(this._world.triggers);
  }

  setVisible(v: boolean) {
    const d = v ? '' : 'none';
    this._editorWrap.style.display = d;
    this.layerGrid.el.style.display = d;
    this.palette.el.style.display = d;
    this.palette.roleBar.style.display = 'none';
    this.toolbar.style.display = v ? 'flex' : 'none';
    this.stampPanel.show(v && this._tool === 'stamp');
    this._sidePanel.style.display = v ? 'flex' : 'none';
    if (v) this.triggerEditor.hide();
  }

  destroy() {
    this.palette.destroy();
    this.layerGrid.destroy();
    this.triggerEditor.destroy();
    this.stampPanel.destroy();
    this.toolbar.remove();
    this._editorWrap.remove();
    this._renderer.destroy();
    this._sidePanel.remove();
    this._joystickPanel?.remove();
  }
}
