import type { Camera } from '../engine/renderer';

const EMA = 0.055;
const RAD2DEG = 180 / Math.PI;
const DEAD_ZONE_DEG = 2.5;
const NEUTRAL_PITCH_DEG = 28;

export class GyroCamera {
  enabled = false;
  private _baseAlpha = 0;
  private _baseBeta = NEUTRAL_PITCH_DEG;
  private _baseGamma = 0;
  private _targetYaw = 0;
  private _targetPitch = 0;
  private _steerValue = 0;
  private _targetForward = 0;
  private _hasPermission = false;
  private _smoothYaw = 0;
  private _smoothPitch = 0;
  private _handler: ((e: DeviceOrientationEvent) => void) | null = null;
  private _handlerAbsolute: ((e: DeviceOrientationEvent) => void) | null = null;
  private _motionHandler: ((e: DeviceMotionEvent) => void) | null = null;
  private _sensor: any = null;
  private _motionActive = false;

  async requestPermission(): Promise<boolean> {
    const DOE = DeviceOrientationEvent as any;
    const DME = DeviceMotionEvent as any;

    if (typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        this._hasPermission = result === 'granted';
        if (this._hasPermission && typeof DME.requestPermission === 'function') {
          try {
            const motionResult = await DME.requestPermission();
            this._hasPermission = motionResult === 'granted';
          } catch (_) {}
        }
      } catch {
        this._hasPermission = false;
      }
      return this._hasPermission;
    }

    if (typeof DME.requestPermission === 'function') {
      try {
        const result = await DME.requestPermission();
        this._hasPermission = result === 'granted';
      } catch {
        this._hasPermission = true;
      }
      return this._hasPermission;
    }

    const win = window as any;
    if (typeof win.AbsoluteOrientationSensor === 'function') {
      try {
        const sensor = new win.AbsoluteOrientationSensor({ frequency: 30 });
        await sensor.start();
        sensor.stop();
      } catch (_) {}
    }

    this._hasPermission = true;
    return true;
  }

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

  private _deadZone(v: number): number {
    if (Math.abs(v) < DEAD_ZONE_DEG) return 0;
    return v > 0 ? v - DEAD_ZONE_DEG : v + DEAD_ZONE_DEG;
  }

  private _onOrientation(e: DeviceOrientationEvent) {
    if (e.alpha == null || e.beta == null) return;
    const dYaw = this._deadZone(e.alpha - this._baseAlpha);
    const dPitch = this._deadZone(e.beta - this._baseBeta);
    const dGamma = e.gamma != null ? this._deadZone(e.gamma - this._baseGamma) : 0;
    this._targetYaw = dYaw * 0.4;
    this._targetPitch = dPitch * 0.4;
    this._targetForward = Math.max(-1, Math.min(1, dPitch * 0.025));
    this._steerValue = Math.max(-1, Math.min(1, dGamma / 25));
  }

  /** Управление по акселерометру (DeviceMotion) — почти всегда работает на Android. */
  private _onMotion(e: DeviceMotionEvent) {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;

    const x = a.x;
    const y = a.y;
    const z = a.z;
    const norm = Math.sqrt(x * x + y * y + z * z) || 1;

    const gx = x / norm;
    const gy = y / norm;
    const gz = z / norm;

    const beta = Math.atan2(-gz, -gy + 1e-6) * RAD2DEG;
    const gamma = Math.atan2(gx, -gy + 1e-6) * RAD2DEG;

    const dPitch = this._deadZone(beta - this._baseBeta);
    const dGamma = this._deadZone(gamma - this._baseGamma);

    this._motionActive = true;
    this._targetPitch = dPitch * 0.4;
    this._targetForward = Math.max(-1, Math.min(1, dPitch * 0.025));
    this._steerValue = Math.max(-1, Math.min(1, dGamma / 25));
    this._targetYaw = dGamma * 0.4;
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

    const dYaw = this._deadZone(alpha - this._baseAlpha);
    const dPitch = this._deadZone(beta - this._baseBeta);
    const dGamma = this._deadZone(gamma - this._baseGamma);

    this._targetYaw = dYaw * 0.4;
    this._targetPitch = dPitch * 0.4;
    this._targetForward = Math.max(-1, Math.min(1, dPitch * 0.025));
    this._steerValue = Math.max(-1, Math.min(1, dGamma / 25));
  }

  start() {
    if (!this._hasPermission) return;
    if (this._handler !== null || this._sensor !== null || this._motionHandler !== null) return;

    this.enabled = true;
    const win = window as any;

    if (typeof win.AbsoluteOrientationSensor === 'function') {
      try {
        const sensor = new win.AbsoluteOrientationSensor({ frequency: 30 });
        sensor.addEventListener('reading', () => this._onSensorReading());
        sensor.start();
        this._sensor = sensor;
      } catch (_) {}
    }

    if (this._sensor === null) {
      this._handler = (e) => this._onOrientation(e);
      window.addEventListener('deviceorientation', this._handler);
      this._handlerAbsolute = (e) => this._onOrientation(e);
      try {
        window.addEventListener('deviceorientationabsolute', this._handlerAbsolute);
      } catch (_) {}
    }

    this._motionHandler = (e) => this._onMotion(e);
    window.addEventListener('devicemotion', this._motionHandler);
  }

  stop() {
    this.enabled = false;
    this._steerValue = 0;
    this._targetForward = 0;
    this._motionActive = false;
    this._smoothYaw = 0;
    this._smoothPitch = 0;

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
    if (this._motionHandler) {
      window.removeEventListener('devicemotion', this._motionHandler);
      this._motionHandler = null;
    }
    if (this._sensor) {
      try {
        this._sensor.stop();
      } catch (_) {}
      this._sensor = null;
    }
  }

  calibrate() {
    this._baseAlpha += this._targetYaw / 0.4;
    this._baseBeta += this._targetPitch / 0.4;
    this._baseGamma += this._steerValue * 25;
    this._targetYaw = 0;
    this._targetPitch = 0;
    this._steerValue = 0;
    this._targetForward = 0;
    this._smoothYaw = 0;
    this._smoothPitch = 0;
  }

  getMoveVector(): { forward: number; right: number } {
    if (!this.enabled) return { forward: 0, right: 0 };
    return { forward: this._targetForward, right: this._steerValue };
  }

  getSteer(): number {
    if (!this.enabled) return 0;
    return this._steerValue;
  }

  update(camera: Camera) {
    if (!this.enabled) return;
    this._smoothYaw += (this._targetYaw - this._smoothYaw) * EMA;
    this._smoothPitch += (this._targetPitch - this._smoothPitch) * EMA;
    camera.state.rotationY += (this._smoothYaw - camera.state.rotationY) * EMA;
    camera.state.rotationX += (
      Math.max(-89, Math.min(89, this._smoothPitch)) - camera.state.rotationX
    ) * EMA;
  }

  destroy() {
    this.stop();
  }
}
