/**
 * Панель штампов: дерево, дома, люди, животные, ландшафты.
 * Заменяет кнопку-смайлик — открывает подкатегории моделей.
 */
import type { World } from '../game/world';

export type StampId = 
  | 'bush' | 'tree'
  | 'smallHouse' | 'bigHouse' | 'toilet'
  | 'man' | 'woman'
  | 'cat' | 'dog' | 'unicorn'
  | 'hill' | 'field';

export interface StampDef {
  id: StampId;
  label: string;
  icon: string;
  place: (w: World, x: number, y: number, z: number) => void;
}

const TREE_STAMPS: StampDef[] = [
  { id: 'bush', label: 'Куст', icon: '🌿', place: (w, x, y, z) => w.putBush(x, y, z) },
  { id: 'tree', label: 'Дерево', icon: '🌳', place: (w, x, y, z) => w.putTree(x, y, z, 6) },
];
const HOUSE_STAMPS: StampDef[] = [
  { id: 'smallHouse', label: 'Домик', icon: '🏠', place: (w, x, y, z) => w.putSmallHouse(x, y, z) },
  { id: 'bigHouse', label: 'Большой дом', icon: '🏘️', place: (w, x, y, z) => w.putBigHouse(x, y, z) },
  { id: 'toilet', label: 'Туалет', icon: '🚻', place: (w, x, y, z) => w.putToilet(x, y, z) },
];
const PERSON_STAMPS: StampDef[] = [
  { id: 'man', label: 'Мужчина', icon: '🧑', place: (w, x, y, z) => w.putMan(x, y, z) },
  { id: 'woman', label: 'Женщина', icon: '👩', place: (w, x, y, z) => w.putWoman(x, y, z) },
];
const ANIMAL_STAMPS: StampDef[] = [
  { id: 'cat', label: 'Кошка', icon: '🐱', place: (w, x, y, z) => w.putCat(x, y, z) },
  { id: 'dog', label: 'Собака', icon: '🐕', place: (w, x, y, z) => w.putDog(x, y, z) },
  { id: 'unicorn', label: 'Единорог', icon: '🦄', place: (w, x, y, z) => w.putUnicorn(x, y, z) },
];
const LANDSCAPE_STAMPS: StampDef[] = [
  { id: 'hill', label: 'Холм', icon: '⛰️', place: (w, x, y, z) => w.putHill(x, y, z) },
  { id: 'field', label: 'Поле', icon: '🌾', place: (w, x, y, z) => w.putField(x, y, z) },
];

const CATEGORIES: { id: string; label: string; icon: string; stamps: StampDef[] }[] = [
  { id: 'tree', label: 'Деревья', icon: '🌲', stamps: TREE_STAMPS },
  { id: 'house', label: 'Дома', icon: '🏠', stamps: HOUSE_STAMPS },
  { id: 'person', label: 'Люди', icon: '🧑', stamps: PERSON_STAMPS },
  { id: 'animal', label: 'Животные', icon: '🐾', stamps: ANIMAL_STAMPS },
  { id: 'landscape', label: 'Ландшафты', icon: '🌍', stamps: LANDSCAPE_STAMPS },
];

export class StampPanel {
  readonly el: HTMLElement;
  private _world: World;
  private _selected: StampDef | null = null;
  private _expandedCategory: string | null = null;

  onSelect?: (stamp: StampDef | null) => void;

  constructor(world: World) {
    this._world = world;
    this.el = document.createElement('div');
    this.el.className = 'stamp-panel edit-only';
    this.el.style.display = 'none';
    this._render();
  }

  private _render() {
    this.el.innerHTML = '';
    this.el.className = 'stamp-panel edit-only';

    for (const cat of CATEGORIES) {
      const section = document.createElement('div');
      section.className = 'stamp-cat';
      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'stamp-cat-header' + (this._expandedCategory === cat.id ? ' open' : '');
      header.innerHTML = `<span class="stamp-cat-icon">${cat.icon}</span><span>${cat.label}</span>`;
      header.addEventListener('click', () => {
        this._expandedCategory = this._expandedCategory === cat.id ? null : cat.id;
        this._render();
      });
      section.appendChild(header);

      if (this._expandedCategory === cat.id) {
        const grid = document.createElement('div');
        grid.className = 'stamp-grid';
        for (const s of cat.stamps) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'stamp-btn' + (this._selected?.id === s.id ? ' active' : '');
          btn.innerHTML = `<span class="stamp-btn-icon">${s.icon}</span><span class="stamp-btn-label">${s.label}</span>`;
          btn.title = s.label;
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._selected = this._selected?.id === s.id ? null : s;
            this.el.querySelectorAll('.stamp-btn').forEach(b => b.classList.toggle('active', b === btn));
            this.onSelect?.(this._selected);
          });
          grid.appendChild(btn);
        }
        section.appendChild(grid);
      }
      this.el.appendChild(section);
    }
  }

  get selected(): StampDef | null {
    return this._selected;
  }

  clearSelection() {
    this._selected = null;
    this.el.querySelectorAll('.stamp-btn').forEach(b => b.classList.remove('active'));
    this.onSelect?.(null);
  }

  placeAt(x: number, y: number, z: number) {
    if (!this._selected) return false;
    this._selected.place(this._world, x, y, z);
    return true;
  }

  show(v: boolean) {
    this.el.style.display = v ? 'flex' : 'none';
    if (v && !this._expandedCategory) this._expandedCategory = CATEGORIES[0].id;
    if (v) this._render();
  }

  destroy() {
    this.el.remove();
  }
}
