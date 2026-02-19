import type { TriggerDef } from '../engine/types';

const TRIGGER_TYPES = ['touch', 'click', 'timer', 'score_gte'] as const;
const ACTION_TYPES = ['destroy', 'teleport', 'text', 'sound', 'win', 'lose', 'spawn_block'] as const;

export class TriggerEditor {
  readonly el: HTMLElement;
  private _triggers: TriggerDef[] = [];
  private _nextId = 1;
  private _list: HTMLElement;

  onChange?: (triggers: TriggerDef[]) => void;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'trigger-panel';
    this.el.innerHTML =
      '<button class="btn-close-panel">&times;</button>' +
      '<h3>Triggers</h3>' +
      '<div class="trigger-list"></div>' +
      '<button class="btn-add-trigger">+ Add Trigger</button>';

    this._list = this.el.querySelector('.trigger-list')!;

    this.el.querySelector('.btn-close-panel')!.addEventListener('click', () => this.hide());
    this.el.querySelector('.btn-add-trigger')!.addEventListener('click', () => this._addTrigger());
  }

  show() { this.el.classList.add('show'); }
  hide() { this.el.classList.remove('show'); }
  get visible() { return this.el.classList.contains('show'); }

  load(triggers: TriggerDef[]) {
    this._triggers = [...triggers];
    this._nextId = triggers.reduce((m, t) => Math.max(m, t.id + 1), 1);
    this._render();
  }

  private _addTrigger() {
    this._triggers.push({
      id: this._nextId++,
      type: 'touch',
      target: [0, 0, 0],
      action: 'text',
      params: { text: 'Hello!' },
    });
    this._render();
    this._emit();
  }

  private _removeTrigger(id: number) {
    this._triggers = this._triggers.filter(t => t.id !== id);
    this._render();
    this._emit();
  }

  private _render() {
    this._list.innerHTML = '';
    for (const t of this._triggers) {
      const card = document.createElement('div');
      card.className = 'trigger-card';
      card.innerHTML =
        `<label>IF</label>` +
        `<select class="t-type">${TRIGGER_TYPES.map(tt =>
          `<option value="${tt}"${tt === t.type ? ' selected' : ''}>${tt}</option>`
        ).join('')}</select>` +

        `<label>Target Block (x,y,z)</label>` +
        `<input class="t-target" value="${t.target ? t.target.join(',') : ''}" placeholder="x,y,z">` +

        `<label>THEN</label>` +
        `<select class="t-action">${ACTION_TYPES.map(a =>
          `<option value="${a}"${a === t.action ? ' selected' : ''}>${a}</option>`
        ).join('')}</select>` +

        `<label>Params (JSON)</label>` +
        `<input class="t-params" value='${JSON.stringify(t.params)}'>` +

        `<button class="role-btn" style="margin-top:6px;color:#f44336">Delete</button>`;

      const tid = t.id;

      card.querySelector('.t-type')!.addEventListener('change', (e) => {
        t.type = (e.target as HTMLSelectElement).value as any;
        this._emit();
      });

      card.querySelector('.t-target')!.addEventListener('change', (e) => {
        const parts = (e.target as HTMLInputElement).value.split(',').map(Number);
        if (parts.length === 3 && parts.every(n => !isNaN(n))) {
          t.target = parts as [number, number, number];
        }
        this._emit();
      });

      card.querySelector('.t-action')!.addEventListener('change', (e) => {
        t.action = (e.target as HTMLSelectElement).value as any;
        this._emit();
      });

      card.querySelector('.t-params')!.addEventListener('change', (e) => {
        try { t.params = JSON.parse((e.target as HTMLInputElement).value); } catch {}
        this._emit();
      });

      card.querySelector('button')!.addEventListener('click', () => this._removeTrigger(tid));

      this._list.appendChild(card);
    }
  }

  private _emit() {
    this.onChange?.(this._triggers);
  }

  destroy() {
    this.el.remove();
  }
}
