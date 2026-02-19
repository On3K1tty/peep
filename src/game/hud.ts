export class HUD {
  readonly el: HTMLElement;
  private _msg: HTMLElement;
  private _toast: HTMLElement;
  private _toastTimer = 0;
  private _dpad: HTMLElement;
  private _zoomWrap: HTMLElement;
  private _moveState = { u: false, d: false, l: false, r: false };
  private _zoomDelta = 0;
  private _lastUpTap = 0;

  onJump?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML =
      '<div class="hud-top"><span class="hud-score">0</span></div>' +
      '<div class="hud-msg"></div>' +
      '<div class="hud-toast"></div>' +
      '<div class="hud-dpad" style="display:none">' +
        '<button class="dp dp-u" data-d="u" type="button">&#9650;</button>' +
        '<button class="dp dp-l" data-d="l" type="button">&#9664;</button>' +
        '<button class="dp dp-r" data-d="r" type="button">&#9654;</button>' +
        '<button class="dp dp-d" data-d="d" type="button">&#9660;</button>' +
      '</div>' +
      '<div class="hud-zoom" style="display:none">' +
        '<button class="hz hz-in" type="button">+</button>' +
        '<button class="hz hz-out" type="button">−</button>' +
      '</div>';

    this._msg = this.el.querySelector('.hud-msg')!;
    this._toast = this.el.querySelector('.hud-toast')!;
    this._dpad = this.el.querySelector('.hud-dpad')!;
    this._zoomWrap = this.el.querySelector('.hud-zoom')!;

    this._dpad.querySelectorAll('.dp').forEach((btn) => {
      const d = (btn as HTMLElement).dataset.d!;
      const start = (e: Event) => {
        e.preventDefault();
        if (d === 'u') {
          const now = Date.now();
          if (now - this._lastUpTap < 400) { this.onJump?.(); this._lastUpTap = 0; return; }
          this._lastUpTap = now;
        }
        (this._moveState as any)[d] = true;
      };
      const end = (e: Event) => {
        e.preventDefault();
        (this._moveState as any)[d] = false;
      };
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
      btn.addEventListener('mouseleave', end);
    });

    this._zoomWrap.querySelector('.hz-in')!.addEventListener('click', (e) => { e.preventDefault(); this._zoomDelta += 2; this.onZoomIn?.(); });
    this._zoomWrap.querySelector('.hz-out')!.addEventListener('click', (e) => { e.preventDefault(); this._zoomDelta -= 2; this.onZoomOut?.(); });
    this._zoomWrap.querySelector('.hz-in')!.addEventListener('touchstart', (e) => { e.preventDefault(); this._zoomDelta += 2; this.onZoomIn?.(); }, { passive: false });
    this._zoomWrap.querySelector('.hz-out')!.addEventListener('touchstart', (e) => { e.preventDefault(); this._zoomDelta -= 2; this.onZoomOut?.(); }, { passive: false });
  }

  getMoveInput(): { forward: number; right: number } {
    const m = this._moveState;
    return {
      forward: (m.u ? 1 : 0) - (m.d ? 1 : 0),
      right: (m.r ? 1 : 0) - (m.l ? 1 : 0),
    };
  }

  consumeZoomDelta(): number {
    const d = this._zoomDelta;
    this._zoomDelta = 0;
    return d;
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
    this._zoomWrap.style.display = v ? 'flex' : 'none';
  }

  destroy() {
    this.el.remove();
  }
}
