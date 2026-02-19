export class HUD {
  readonly el: HTMLElement;
  private _msg: HTMLElement;
  private _toast: HTMLElement;
  private _toastTimer = 0;
  private _dpad: HTMLElement;
  private _shootBtn: HTMLElement;
  private _crosshair: HTMLElement;

  onJump?: () => void;
  onShoot?: () => void;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML =
      '<div class="hud-top"><span class="hud-score">0</span></div>' +
      '<div class="hud-crosshair">+</div>' +
      '<div class="hud-msg"></div>' +
      '<div class="hud-toast"></div>' +
      '<div class="hud-dpad">' +
        '<button class="dp dp-u" data-d="u">&#9650;</button>' +
        '<button class="dp dp-l" data-d="l">&#9664;</button>' +
        '<button class="dp dp-r" data-d="r">&#9654;</button>' +
        '<button class="dp dp-d" data-d="d">&#9660;</button>' +
        '<button class="dp dp-j" data-d="j">&#8679;</button>' +
      '</div>' +
      '<button class="hud-shoot">&#9678;</button>';

    this._msg = this.el.querySelector('.hud-msg')!;
    this._toast = this.el.querySelector('.hud-toast')!;
    this._dpad = this.el.querySelector('.hud-dpad')!;
    this._shootBtn = this.el.querySelector('.hud-shoot')!;
    this._crosshair = this.el.querySelector('.hud-crosshair')!;

    this._bindDpad();
    this._shootBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.onShoot?.(); }, { passive: false });
    this._shootBtn.addEventListener('mousedown', (e) => { e.preventDefault(); this.onShoot?.(); });
  }

  private _moveState = { u: false, d: false, l: false, r: false };

  private _bindDpad() {
    const start = (e: Event) => {
      e.preventDefault();
      const d = (e.target as HTMLElement).dataset.d;
      if (!d) return;
      if (d === 'j') { this.onJump?.(); return; }
      (this._moveState as any)[d] = true;
    };
    const end = (e: Event) => {
      e.preventDefault();
      const d = (e.target as HTMLElement).dataset.d;
      if (d && d !== 'j') (this._moveState as any)[d] = false;
    };

    this._dpad.addEventListener('touchstart', start, { passive: false });
    this._dpad.addEventListener('touchend', end, { passive: false });
    this._dpad.addEventListener('mousedown', start);
    this._dpad.addEventListener('mouseup', end);
    this._dpad.addEventListener('mouseleave', end);
  }

  getMoveInput(): { forward: number; right: number } {
    const m = this._moveState;
    return {
      forward: (m.u ? 1 : 0) - (m.d ? 1 : 0),
      right: (m.r ? 1 : 0) - (m.l ? 1 : 0),
    };
  }

  setScore(n: number) {
    // Score is now set via innerHTML from app.ts (includes hearts)
  }

  showMessage(text: string) {
    this._msg.textContent = text;
    this._msg.style.display = text ? 'block' : 'none';
  }

  toast(text: string, durationMs = 2000) {
    this._toast.textContent = text;
    this._toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(() => {
      this._toast.classList.remove('show');
    }, durationMs);
  }

  setDpadVisible(v: boolean) {
    this._dpad.style.display = v ? 'flex' : 'none';
    this._shootBtn.style.display = v ? 'flex' : 'none';
    this._crosshair.style.display = v ? 'block' : 'none';
  }

  destroy() {
    this.el.remove();
  }
}
