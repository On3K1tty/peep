import type { Camera } from '../engine/renderer';

const EMA = 0.12;
const RAD2DEG = 180 / Math.PI;

type OrientationSource = 'deviceorientation' | 'deviceorientationabsolute' | 'sensor';

export class GyroCamera {
  enabled = false;
  private _baseAlpha = 0;
  private _baseBeta = 0;
  private _baseGamma = 0;
  private _targetYaw = 0;
  private _targetPitch = 0;
  private _steerValue = 0;
  private _targetForward = 0;
  private _hasPermission = false;
  private _handler: ((e: DeviceOrientationEvent) => void) | null = null;
  private _handlerAbsolute: ((e: DeviceOrientationEvent) => void) | null = null;
  private _sensor: any = null;
  private _source: OrientationSource | null = null;

  async requestPermission(): Promise<boolean> {
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        this._hasPermission = result === 'granted';
      } catch {
        this._hasPermission = false;
      }
      return this._hasPermission;
    }

    // Android: нет requestPermission, но нужен доступ к сенсорам.
    // Пробуем включить AbsoluteOrientationSensor — на Chrome Android это запрашивает разрешение.
    const win = window as any;
    if (typeof win.AbsoluteOrientationSensor === 'function') {
      try {
        const sensor = new win.AbsoluteOrientationSensor({ frequency: 30 });
        await sensor.start();
        sensor.stop();
        this._hasPermission = true;
      } catch {
        this._hasPermission = true;
      }
      return this._hasPermission;
    }

    this._hasPermission = true;
    return true;
  }

  /** Toggle gyro on/off. Requests permission on first enable. Returns new state. */
  async toggle(): Promise<boolean> {
    if (this.enabled) {
      this.stop();
      return false;
    }
    if (!this._hasPermission) {
      const ok = await this.requestPermission();
      if (!ok) return false;
    }
    this.start();
    return true;
  }

  private _onOrientation(e: DeviceOrientationEvent) {
    if (e.alpha == null || e.beta == null) return;
    this._targetYaw = (e.alpha - this._baseAlpha) * 0.4;
    this._targetPitch = (e.beta - this._baseBeta) * 0.4;
    this._targetForward = Math.max(-1, Math.min(1, (e.beta - this._baseBeta) * 0.025));
    if (e.gamma != null) {
      this._steerValue = Math.max(-1, Math.min(1, (e.gamma - this._baseGamma) / 25));
    }
  }

  private _onSensorReading() {
    const s = this._sensor;
    if (!s || !s.quaternion) return;
    const [x, y, z, w] = s.quaternion;
    const siny = 2 * (w * z + x * y);
    const cosy = 1 - 2 * (y * y + z * z);
    const alpha = Math.atan2(siny, cosy) * RAD2DEG;
    const sinp = 2 * (w * y - z * x);
    const beta = Math.asin(Math.max(-1, Math.min(1, sinp))) * RAD2DEG;
    const sinr = 2 * (w * x + y * z);
    const cosr = 1 - 2 * (x * x + y * y);
    const gamma = Math.atan2(sinr, cosr) * RAD2DEG;

    this._targetYaw = (alpha - this._baseAlpha) * 0.4;
    this._targetPitch = (beta - this._baseBeta) * 0.4;
    this._targetForward = Math.max(-1, Math.min(1, (beta - this._baseBeta) * 0.025));
    this._steerValue = Math.max(-1, Math.min(1, (gamma - this._baseGamma) / 25));
  }

  start() {
    if (!this._hasPermission) return;
    if (this._handler || this._sensor) return;

    this.enabled = true;

    const win = window as any;

    // 1) Android Chrome: Generic Sensor API (часто работает, когда DeviceOrientation — нет)
    if (typeof win.AbsoluteOrientationSensor === 'function') {
      try {
        const sensor = new win.AbsoluteOrientationSensor({ frequency: 30 });
        sensor.addEventListener('reading', () => this._onSensorReading());
        sensor.start();
        this._sensor = sensor;
        this._source = 'sensor';
      } catch (_) {}
    }

    // 2) DeviceOrientationEvent (iOS и часть Android)
    if (!this._sensor) {
      this._handler = (e) => this._onOrientation(e);
      window.addEventListener('deviceorientation', this._handler);
      this._source = 'deviceorientation';

      this._handlerAbsolute = (e) => this._onOrientation(e);
      try {
        window.addEventListener('deviceorientationabsolute', this._handlerAbsolute);
        this._source = 'deviceorientationabsolute';
      } catch (_) {}
    }
  }

  stop() {
    this.enabled = false;
    this._steerValue = 0;
    this._targetForward = 0;

    if (this._handler) {
      window.removeEventListener('deviceorientation', this._handler);
      this._handler = null;
    }
    if (this._handlerAbsolute) {
      try {
        window.removeEventListener('deviceorientationabsolute', this._handlerAbsolute);
      } catch (_) {}
      this._handlerAbsolute = null;
    }
    if (this._sensor) {
      try {
        this._sensor.stop();
      } catch (_) {}
      this._sensor = null;
    }
    this._source = null;
  }

  /** Reset current orientation as neutral (double-tap to recalibrate). */
  calibrate() {
    this._baseAlpha += this._targetYaw / 0.4;
    this._baseBeta += this._targetPitch / 0.4;
    this._baseGamma += this._steerValue * 25;
    this._targetYaw = 0;
    this._targetPitch = 0;
    this._steerValue = 0;
    this._targetForward = 0;
  }

  /** Forward/right from tilt: tilt phone forward = go forward, tilt right = go right. */
  getMoveVector(): { forward: number; right: number } {
    if (!this.enabled) return { forward: 0, right: 0 };
    return { forward: this._targetForward, right: this._steerValue };
  }

  /** Returns -1 (left) to 1 (right) tilt for steering. */
  getSteer(): number {
    if (!this.enabled) return 0;
    return this._steerValue;
  }

  /** Apply gyro orientation to camera (for editor/play mode). */
  update(camera: Camera) {
    if (!this.enabled) return;
    camera.state.rotationY += (this._targetYaw - camera.state.rotationY) * EMA;
    camera.state.rotationX += (
      Math.max(-89, Math.min(89, this._targetPitch)) - camera.state.rotationX
    ) * EMA;
  }

  destroy() {
    this.stop();
  }
}
