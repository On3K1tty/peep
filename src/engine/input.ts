export interface InputState {
  keys: Set<string>;
  pointerDown: boolean;
  pointerX: number;
  pointerY: number;
  deltaX: number;
  deltaY: number;
  pinchDelta: number;
}

export class InputManager {
  state: InputState = {
    keys: new Set(),
    pointerDown: false,
    pointerX: 0,
    pointerY: 0,
    deltaX: 0,
    deltaY: 0,
    pinchDelta: 0,
  };

  private _el: HTMLElement;
  private _listeners: [EventTarget, string, EventListener][] = [];
  private _lastTouchDist = 0;
  private _onVoxelClick?: (e: { x: number; y: number; z: number; normal: string }) => void;

  constructor(el: HTMLElement) {
    this._el = el;
    this._bind();
  }

  onVoxelClick(cb: (e: { x: number; y: number; z: number; normal: string }) => void) {
    this._onVoxelClick = cb;
  }

  /** Must be called every frame to reset deltas */
  resetDeltas() {
    this.state.deltaX = 0;
    this.state.deltaY = 0;
    this.state.pinchDelta = 0;
  }

  private _on<K extends keyof HTMLElementEventMap>(
    target: EventTarget,
    event: string,
    handler: EventListener,
    opts?: AddEventListenerOptions,
  ) {
    target.addEventListener(event, handler, opts);
    this._listeners.push([target, event, handler]);
  }

  private _bind() {
    // Keyboard
    this._on(window, 'keydown', (e) => {
      this.state.keys.add((e as KeyboardEvent).code);
    });
    this._on(window, 'keyup', (e) => {
      this.state.keys.delete((e as KeyboardEvent).code);
    });

    // Mouse
    this._on(this._el, 'mousedown', (e) => {
      this.state.pointerDown = true;
      const me = e as MouseEvent;
      this.state.pointerX = me.clientX;
      this.state.pointerY = me.clientY;
    });
    this._on(window, 'mouseup', () => {
      this.state.pointerDown = false;
    });
    this._on(window, 'mousemove', (e) => {
      const me = e as MouseEvent;
      if (this.state.pointerDown) {
        this.state.deltaX += me.clientX - this.state.pointerX;
        this.state.deltaY += me.clientY - this.state.pointerY;
      }
      this.state.pointerX = me.clientX;
      this.state.pointerY = me.clientY;
    });

    // Mouse wheel zoom
    this._on(this._el, 'wheel', (e) => {
      e.preventDefault();
      this.state.pinchDelta += (e as WheelEvent).deltaY * 0.01;
    }, { passive: false });

    // Touch
    this._on(this._el, 'touchstart', (e) => {
      e.preventDefault();
      const te = e as TouchEvent;
      if (te.touches.length === 1) {
        this.state.pointerDown = true;
        this.state.pointerX = te.touches[0].clientX;
        this.state.pointerY = te.touches[0].clientY;
      }
      if (te.touches.length === 2) {
        this._lastTouchDist = this._touchDist(te);
      }
    }, { passive: false });

    this._on(this._el, 'touchmove', (e) => {
      e.preventDefault();
      const te = e as TouchEvent;
      if (te.touches.length === 1 && this.state.pointerDown) {
        const tx = te.touches[0].clientX;
        const ty = te.touches[0].clientY;
        this.state.deltaX += tx - this.state.pointerX;
        this.state.deltaY += ty - this.state.pointerY;
        this.state.pointerX = tx;
        this.state.pointerY = ty;
      }
      if (te.touches.length === 2) {
        const dist = this._touchDist(te);
        this.state.pinchDelta += (this._lastTouchDist - dist) * 0.05;
        this._lastTouchDist = dist;
      }
    }, { passive: false });

    this._on(this._el, 'touchend', () => {
      this.state.pointerDown = false;
    });

    // Voxel click detection via DOM event delegation
    this._on(this._el, 'click', (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.vx !== undefined && this._onVoxelClick) {
        this._onVoxelClick({
          x: Number(target.dataset.vx),
          y: Number(target.dataset.vy),
          z: Number(target.dataset.vz),
          normal: target.dataset.normal || '',
        });
      }
    });
  }

  private _touchDist(e: TouchEvent): number {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  destroy() {
    for (const [target, event, handler] of this._listeners) {
      target.removeEventListener(event, handler);
    }
    this._listeners.length = 0;
  }
}
