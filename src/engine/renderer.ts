import { Mat4, Vec3, DEG } from './math';

export interface CameraState {
  /** Camera position in voxel units (fly mode) */
  position: Vec3;
  /** Vertical orbit angle in degrees (negative = looking from above) */
  rotationX: number;
  /** Horizontal orbit angle in degrees */
  rotationY: number;
  /** Orbit distance in voxel units */
  distance: number;
  /** Orbit target point in voxel units */
  target: Vec3;
}

export class Camera {
  state: CameraState;
  mode: 'orbit' | 'fly';

  constructor(mode: 'orbit' | 'fly' = 'orbit') {
    this.mode = mode;
    this.state = {
      position: new Vec3(0, 5, 10),
      rotationX: -25,
      rotationY: 45,
      distance: 20,
      target: new Vec3(0, 0, 0),
    };
  }

  /**
   * Compute view matrix. Converts from voxel units to CSS pixel space.
   * World coords: X right, Y up, Z towards viewer.
   * CSS coords:   X right, Y down, Z towards viewer.
   */
  getViewMatrix(voxelSize = 1): Mat4 {
    const s = voxelSize;

    if (this.mode === 'orbit') {
      const rx = Mat4.rotationX(this.state.rotationX * DEG);
      const ry = Mat4.rotationY(this.state.rotationY * DEG);
      // Negate x,z to center on target; Y is inverted (world up = CSS down)
      const t = Mat4.translation(
        -this.state.target.x * s,
        this.state.target.y * s,
        -this.state.target.z * s,
      );
      const pull = Mat4.translation(0, 0, -this.state.distance * s);
      return pull.multiply(rx).multiply(ry).multiply(t);
    }

    // fly camera
    const rx = Mat4.rotationX(-this.state.rotationX * DEG);
    const ry = Mat4.rotationY(-this.state.rotationY * DEG);
    const t = Mat4.translation(
      -this.state.position.x * s,
      this.state.position.y * s,
      -this.state.position.z * s,
    );
    return rx.multiply(ry).multiply(t);
  }

  orbit(dx: number, dy: number) {
    this.state.rotationY += dx;
    this.state.rotationX = Math.max(-89, Math.min(89, this.state.rotationX + dy));
  }

  zoom(delta: number) {
    this.state.distance = Math.max(2, Math.min(100, this.state.distance + delta));
  }

  moveLocal(forward: number, right: number, up: number) {
    const ry = this.state.rotationY * DEG;
    const sinY = Math.sin(ry), cosY = Math.cos(ry);
    this.state.position.x += right * cosY - forward * sinY;
    this.state.position.y += up;
    this.state.position.z += right * sinY + forward * cosY;
  }
}

export class Renderer {
  readonly root: HTMLDivElement;
  readonly world: HTMLDivElement;
  readonly camera: Camera;
  private _perspectivePx: number;
  private _voxelSize: number;

  constructor(
    container: HTMLElement,
    camera: Camera,
    perspectivePx = 800,
    voxelSize = 20,
  ) {
    this.camera = camera;
    this._perspectivePx = perspectivePx;
    this._voxelSize = voxelSize;

    this.root = document.createElement('div');
    this.root.className = 'voxel-world';
    Object.assign(this.root.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      contain: 'strict',
      perspective: `${perspectivePx}px`,
      perspectiveOrigin: '50% 50%',
    } as CSSStyleDeclaration);

    this.world = document.createElement('div');
    Object.assign(this.world.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transformStyle: 'preserve-3d',
      willChange: 'transform',
    } as CSSStyleDeclaration);

    this.root.appendChild(this.world);
    container.appendChild(this.root);
  }

  get voxelSize() { return this._voxelSize; }
  get perspectivePx() { return this._perspectivePx; }

  render() {
    const view = this.camera.getViewMatrix(this._voxelSize);
    this.world.style.transform = view.toCSS();
  }

  destroy() {
    this.root.remove();
  }
}
