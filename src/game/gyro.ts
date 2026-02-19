import type { Camera } from '../engine/renderer';

const EMA = 0.12;

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

  async requestPermission(): Promise<boolean> {
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        this._hasPermission = result === 'granted';
      } catch {
        this._hasPermission = false;
      }
    } else {
      this._hasPermission = true;
    }
    return this._hasPermission;
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

  start() {
    if (!this._hasPermission || this._handler) return;
    this.enabled = true;
    this._handler = (e) => {
      if (e.alpha == null || e.beta == null) return;
      this._targetYaw = (e.alpha - this._baseAlpha) * 0.4;
      this._targetPitch = (e.beta - this._baseBeta) * 0.4;
      this._targetForward = Math.max(-1, Math.min(1, (e.beta - this._baseBeta) * 0.025));
      if (e.gamma != null) {
        this._steerValue = Math.max(-1, Math.min(1, (e.gamma - this._baseGamma) / 25));
      }
    };
    window.addEventListener('deviceorientation', this._handler);
  }

  stop() {
    this.enabled = false;
    this._steerValue = 0;
    this._targetForward = 0;
    if (this._handler) {
      window.removeEventListener('deviceorientation', this._handler);
      this._handler = null;
    }
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
