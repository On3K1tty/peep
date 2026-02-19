import type { Camera } from '../engine/renderer';

const EMA = 0.12;

export class GyroCamera {
  enabled = false;
  private _baseAlpha = 0;
  private _baseBeta = 0;
  private _targetYaw = 0;
  private _targetPitch = 0;
  private _hasPermission = false;
  private _handler: ((e: DeviceOrientationEvent) => void) | null = null;

  async requestPermission(): Promise<boolean> {
    // iOS 13+ requires explicit permission
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

  start() {
    if (!this._hasPermission || this._handler) return;
    this.enabled = true;
    this._handler = (e) => {
      if (e.alpha == null || e.beta == null) return;
      this._targetYaw = (e.alpha - this._baseAlpha) * 0.4;
      this._targetPitch = (e.beta - this._baseBeta) * 0.4;
    };
    window.addEventListener('deviceorientation', this._handler);
  }

  stop() {
    this.enabled = false;
    if (this._handler) {
      window.removeEventListener('deviceorientation', this._handler);
      this._handler = null;
    }
  }

  calibrate() {
    this._baseAlpha += this._targetYaw / 0.4;
    this._baseBeta += this._targetPitch / 0.4;
    this._targetYaw = 0;
    this._targetPitch = 0;
  }

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
