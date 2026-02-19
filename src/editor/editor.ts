import { Camera, Renderer } from '../engine/renderer';
import { WorldMesh } from '../engine/voxel';
import { World } from '../game/world';
import { Palette } from './palette';
import { TriggerEditor } from './trigger-ui';
import { playSound } from '../game/sound';
import { t, getLangs, setLang, getLang } from '../app/i18n';

type EditorTool = 'draw' | 'erase' | 'role';

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
  readonly triggerEditor: TriggerEditor;

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

  onPlay?: () => void;
  onSave?: () => void;
  onShare?: () => void;

  constructor(world: World, container: HTMLElement) {
    this._world = world;

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
    this._cam.state.distance = 35;
    this._cam.state.rotationX = -30;
    this._cam.state.rotationY = 35;
    this._cam.state.target.set(16, 4, 16);
    this._renderer = new Renderer(this._editorWrap, this._cam, 700, 8);
    this._mesh = new WorldMesh(8);
    this._renderer.world.appendChild(this._mesh.el);
    this._mesh.el.style.transformStyle = 'preserve-3d';

    this._bindEditorInput();

    // Render loop
    const renderLoop = () => {
      this._renderer.render();
      requestAnimationFrame(renderLoop);
    };
    requestAnimationFrame(renderLoop);

    // Palette
    this.palette = new Palette(world.palette);
    container.appendChild(this.palette.el);
    container.appendChild(this.palette.roleBar);

    // Trigger editor
    this.triggerEditor = new TriggerEditor();
    this.triggerEditor.onChange = (triggers) => { world.triggers = triggers; };
    this.triggerEditor.load(world.triggers);
    container.appendChild(this.triggerEditor.el);

    // Toolbar
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'toolbar edit-only';
    this._rebuildToolbar();
    container.appendChild(this.toolbar);
    this._bindToolbar();

    this._refreshMesh();
    this._updateUndoButtons();
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

    if (nx < 0 || nx >= 32 || ny < 0 || ny >= 32 || nz < 0 || nz >= 32) return;
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

  // Toolbar

  private _rebuildToolbar() {
    this.toolbar.innerHTML =
      `<button class="active" data-tool="draw">${t('draw')}</button>` +
      `<button data-tool="erase">${t('erase')}</button>` +
      `<button data-tool="role">${t('role')}</button>` +
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
    });
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
        return;
      }
      if (btn.classList.contains('tb-triggers')) this.triggerEditor.show();
      else if (btn.classList.contains('tb-play')) this.onPlay?.();
      else if (btn.classList.contains('tb-save')) this.onSave?.();
      else if (btn.classList.contains('tb-share')) this.onShare?.();
    });
  }

  private _refreshMesh() {
    this._mesh.rebuildFromGrid(this._world.grid, this._world.palette);
  }

  refresh() {
    this._refreshMesh();
    this.triggerEditor.load(this._world.triggers);
  }

  setVisible(v: boolean) {
    const d = v ? '' : 'none';
    this._editorWrap.style.display = d;
    this.palette.el.style.display = d;
    this.palette.roleBar.style.display = 'none';
    this.toolbar.style.display = v ? 'flex' : 'none';
    this._sidePanel.style.display = v ? 'flex' : 'none';
    if (v) this.triggerEditor.hide();
  }

  destroy() {
    this.palette.destroy();
    this.triggerEditor.destroy();
    this.toolbar.remove();
    this._editorWrap.remove();
    this._renderer.destroy();
    this._sidePanel.remove();
  }
}
