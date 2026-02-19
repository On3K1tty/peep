export class HUD {
  readonly el: HTMLElement;
  private _msg: HTMLElement;
  private _toast: HTMLElement;
  private _toastTimer = 0;
  private _dpad: HTMLElement;
  private _shootBtn: HTMLElement;
  private _crosshair: HTMLElement;

  onJump?: () => void;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML =
      '<div class="hud-top"><span class="hud-score">0</span></div>' +
      '<div class="hud-msg"></div>' +
      '<div class="hud-toast"></div>' +
      '<button class="hud-jump" type="button">&#8679;</button>';

    this._msg = this.el.querySelector('.hud-msg')!;
    this._toast = this.el.querySelector('.hud-toast')!;
    this._dpad = this.el; // unused, keep for setDpadVisible no-op
    this._shootBtn = this.el;
    this._crosshair = this.el;

    const jumpBtn = this.el.querySelector('.hud-jump')!;
    jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.onJump?.(); }, { passive: false });
    jumpBtn.addEventListener('mousedown', (e) => { e.preventDefault(); this.onJump?.(); });
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

  setDpadVisible(_v: boolean) {
    // Movement is gyro-only; jump button visibility unchanged
  }

  destroy() {
    this.el.remove();
  }
}
