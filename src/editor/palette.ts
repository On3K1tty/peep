import { ROLE_NAMES } from '../engine/types';
import { BlockRole } from '../engine/types';

export class Palette {
  readonly el: HTMLElement;
  readonly roleBar: HTMLElement;

  private _selected = 1;
  private _role: number = BlockRole.SOLID;
  private _colors: string[];

  onChange?: (colorIndex: number, role: number) => void;

  constructor(colors: string[]) {
    this._colors = colors;

    // Color palette bar
    this.el = document.createElement('div');
    this.el.className = 'palette-bar edit-only';
    this._renderSwatches();

    // Role bar
    this.roleBar = document.createElement('div');
    this.roleBar.className = 'role-bar edit-only';
    this._renderRoles();
  }

  get selectedColor() { return this._selected; }
  get selectedRole() { return this._role; }
  get colorHex() { return this._colors[this._selected] || '#ff00ff'; }

  private _renderSwatches() {
    this.el.innerHTML = '';
    for (let i = 1; i < this._colors.length; i++) {
      const sw = document.createElement('div');
      sw.className = 'pal-swatch' + (i === this._selected ? ' active' : '');
      sw.style.background = this._colors[i];
      sw.dataset.i = String(i);
      this.el.appendChild(sw);
    }
    this.el.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('.pal-swatch') as HTMLElement;
      if (!t) return;
      this._selected = Number(t.dataset.i);
      this.el.querySelectorAll('.pal-swatch').forEach(s =>
        s.classList.toggle('active', s === t));
      this.onChange?.(this._selected, this._role);
    });
  }

  private _renderRoles() {
    this.roleBar.innerHTML = '';
    for (let i = 0; i < ROLE_NAMES.length; i++) {
      const btn = document.createElement('button');
      btn.className = 'role-btn' + (i === this._role ? ' active' : '');
      btn.textContent = ROLE_NAMES[i];
      btn.dataset.r = String(i);
      this.roleBar.appendChild(btn);
    }
    this.roleBar.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('.role-btn') as HTMLElement;
      if (!t) return;
      this._role = Number(t.dataset.r);
      this.roleBar.querySelectorAll('.role-btn').forEach(b =>
        b.classList.toggle('active', b === t));
      this.onChange?.(this._selected, this._role);
    });
  }

  showRoles(v: boolean) {
    this.roleBar.classList.toggle('show', v);
  }

  destroy() {
    this.el.remove();
    this.roleBar.remove();
  }
}
