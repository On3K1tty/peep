/**
 * 2D layer-by-layer editor: one Y slice at a time, tap to place/remove.
 * Single canvas ~250x250; grid is X (columns) x Z (rows) for current layer Y.
 */
import type { World } from '../game/world';
import { WORLD_SX, WORLD_SY, WORLD_SZ } from '../game/world';

const CANVAS_SIZE = 250;
const SX = WORLD_SX;
const SZ = WORLD_SZ;

export class LayerGrid {
  readonly el: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  private _world: World;
  private _layerY = 0;
  private _selectedColor = 1;
  private _selectedRole = 0;
  private _cellW = 0;
  private _cellH = 0;
  private _ctx: CanvasRenderingContext2D | null = null;

  onChange?: () => void;

  constructor(world: World) {
    this._world = world;
    this.el = document.createElement('div');
    this.el.className = 'layer-grid edit-only';

    const header = document.createElement('div');
    header.className = 'layer-grid-header';
    const layerLabel = document.createElement('span');
    layerLabel.className = 'layer-grid-label';
    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'layer-grid-btn';
    upBtn.textContent = 'Up';
    upBtn.addEventListener('click', () => this._setLayer(Math.min(WORLD_SY - 1, this._layerY + 1)));
    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'layer-grid-btn';
    downBtn.textContent = 'Down';
    downBtn.addEventListener('click', () => this._setLayer(Math.max(0, this._layerY - 1)));

    header.appendChild(downBtn);
    header.appendChild(layerLabel);
    header.appendChild(upBtn);

    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_SIZE;
    this.canvas.height = CANVAS_SIZE;
    this.canvas.className = 'layer-grid-canvas';
    this.canvas.style.display = 'none';

    this.el.appendChild(header);
    this.el.appendChild(this.canvas);

    this._updateLabel = () => {
      layerLabel.textContent = `Layer ${this._layerY + 1} of ${WORLD_SY}`;
    };

    this._ctx = this.canvas.getContext('2d');
    this._cellW = CANVAS_SIZE / SX;
    this._cellH = CANVAS_SIZE / SZ;

    this._bindPointer();
    this._updateLabel();
    this._draw();
  }

  private _updateLabel: () => void;

  setSelectedColor(colorIndex: number) {
    this._selectedColor = colorIndex;
  }

  setSelectedRole(role: number) {
    this._selectedRole = role;
  }

  setLayer(y: number) {
    this._layerY = Math.max(0, Math.min(WORLD_SY - 1, y));
    this._updateLabel();
    this._draw();
  }

  private _setLayer(y: number) {
    this._layerY = y;
    this._updateLabel();
    this._draw();
  }

  refresh() {
    this._draw();
  }

  private _draw() {
    const ctx = this._ctx;
    if (!ctx) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const cw = this._cellW;
    const ch = this._cellH;
    const palette = this._world.palette;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    for (let z = 0; z < SZ; z++) {
      for (let x = 0; x < SX; x++) {
        const blockId = this._world.get(x, this._layerY, z);
        const color = blockId === 0 ? '#0f3460' : (palette[blockId] || '#ff00ff');
        ctx.fillStyle = color;
        const px = x * cw;
        const py = z * ch;
        ctx.fillRect(px + 0.5, py + 0.5, Math.max(1, cw - 1), Math.max(1, ch - 1));
      }
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= SX; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cw, 0);
      ctx.lineTo(i * cw, h);
      ctx.stroke();
    }
    for (let i = 0; i <= SZ; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * ch);
      ctx.lineTo(w, i * ch);
      ctx.stroke();
    }
  }

  private _bindPointer() {
    const getCell = (e: MouseEvent | Touch): { x: number; z: number } | null => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const clientX = 'clientX' in e ? e.clientX : e.clientX;
      const clientY = 'clientY' in e ? e.clientY : e.clientY;
      const px = (clientX - rect.left) * scaleX;
      const py = (clientY - rect.top) * scaleY;
      const x = Math.floor(px / this._cellW);
      const z = Math.floor(py / this._cellH);
      if (x < 0 || x >= SX || z < 0 || z >= SZ) return null;
      return { x, z };
    };

    const handleTap = (e: Event) => {
      e.preventDefault();
      const ev = e as MouseEvent & { touches?: TouchList };
      const t = ev.touches?.[0];
      const cell = t ? getCell(t as unknown as Touch) : getCell(ev);
      if (!cell) return;
      const { x, z } = cell;
      const y = this._layerY;
      const blockId = this._world.get(x, y, z);
      if (blockId === 0) {
        this._world.set(x, y, z, this._selectedColor, this._selectedRole);
      } else {
        this._world.clear(x, y, z);
      }
      this._draw();
      this.onChange?.();
    };

    this.canvas.addEventListener('mousedown', handleTap);
    this.canvas.addEventListener('touchstart', handleTap, { passive: false });
  }

  destroy() {
    this.el.remove();
  }
}
