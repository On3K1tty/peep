import { WORLD_SIZE, type World } from '../game/world';
import { t } from '../app/i18n';

const S = WORLD_SIZE;
const GRID_PX = 10;

export class LayerGrid {
  readonly el: HTMLElement;
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _layer = 0;
  private _world: World;
  private _layerLabel: HTMLElement;
  private _canvasSize = S * GRID_PX;

  onCellTap?: (x: number, z: number, layer: number) => void;

  constructor(world: World) {
    this._world = world;

    this.el = document.createElement('div');
    this.el.className = 'layer-panel edit-only';
    this.el.innerHTML =
      '<div class="layer-header">' +
        '<button class="ly-dn">&darr;</button>' +
        '<span class="ly-label">Layer 0 / 31</span>' +
        '<button class="ly-up">&uarr;</button>' +
      '</div>' +
      '<div class="layer-canvas-wrap"><canvas></canvas></div>';

    this._layerLabel = this.el.querySelector('.ly-label')!;
    this._canvas = this.el.querySelector('canvas')!;
    this._ctx = this._canvas.getContext('2d')!;

    this._canvas.width = this._canvasSize;
    this._canvas.height = this._canvasSize;

    // Canvas fills available space in its container
    this._canvas.style.width = '100%';
    this._canvas.style.height = '100%';
    this._canvas.style.objectFit = 'contain';
    this._canvas.style.maxWidth = '400px';
    this._canvas.style.maxHeight = '100%';

    this.el.querySelector('.ly-up')!.addEventListener('click', () => this.setLayer(this._layer + 1));
    this.el.querySelector('.ly-dn')!.addEventListener('click', () => this.setLayer(this._layer - 1));

    this._bindCanvas();
    this.draw();
  }

  get layer() { return this._layer; }

  setLayer(y: number) {
    this._layer = Math.max(0, Math.min(S - 1, y));
    this.updateLabel();
    this.draw();
  }

  updateLabel() {
    this._layerLabel.textContent = `${t('layer')} ${this._layer} ${t('of')} ${S - 1}`;
  }

  draw() {
    const ctx = this._ctx;
    const px = GRID_PX;
    const w = this._world;
    const y = this._layer;
    const palette = w.palette;

    ctx.clearRect(0, 0, this._canvasSize, this._canvasSize);

    // Draw grid
    for (let z = 0; z < S; z++) {
      for (let x = 0; x < S; x++) {
        const blockId = w.get(x, y, z);
        if (blockId > 0) {
          ctx.fillStyle = palette[blockId] || '#ff00ff';
          ctx.fillRect(x * px, (S - 1 - z) * px, px, px);

          // Role indicator dot
          const role = w.getRole(x, y, z);
          if (role > 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = `${px * 0.6}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const markers = ['', '!', '~', '*', 'S', 'F', 'M', 'P'];
            ctx.fillText(
              markers[role] || '',
              x * px + px / 2,
              (S - 1 - z) * px + px / 2,
            );
          }
        } else {
          // Empty cell — checkerboard
          ctx.fillStyle = (x + z) % 2 === 0 ? '#1a1a28' : '#1f1f30';
          ctx.fillRect(x * px, (S - 1 - z) * px, px, px);
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= S; i++) {
      ctx.beginPath();
      ctx.moveTo(i * px, 0); ctx.lineTo(i * px, this._canvasSize);
      ctx.moveTo(0, i * px); ctx.lineTo(this._canvasSize, i * px);
      ctx.stroke();
    }
  }

  private _bindCanvas() {
    const getCell = (e: MouseEvent | Touch): [number, number] | null => {
      const rect = this._canvas.getBoundingClientRect();
      const scaleX = this._canvasSize / rect.width;
      const scaleY = this._canvasSize / rect.height;
      const cx = ((e as any).clientX - rect.left) * scaleX;
      const cy = ((e as any).clientY - rect.top) * scaleY;
      const x = Math.floor(cx / GRID_PX);
      const z = S - 1 - Math.floor(cy / GRID_PX);
      if (x < 0 || x >= S || z < 0 || z >= S) return null;
      return [x, z];
    };

    let drawing = false;

    const handle = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const point = 'touches' in e ? e.touches[0] : e as MouseEvent;
      if (!point) return;
      const cell = getCell(point);
      if (cell) this.onCellTap?.(cell[0], cell[1], this._layer);
    };

    this._canvas.addEventListener('mousedown', (e) => { drawing = true; handle(e); });
    this._canvas.addEventListener('mousemove', (e) => { if (drawing) handle(e); });
    window.addEventListener('mouseup', () => { drawing = false; });

    this._canvas.addEventListener('touchstart', (e) => { drawing = true; handle(e); }, { passive: false });
    this._canvas.addEventListener('touchmove', (e) => { if (drawing) handle(e); }, { passive: false });
    this._canvas.addEventListener('touchend', () => { drawing = false; });
  }

  destroy() {
    this.el.remove();
  }
}
