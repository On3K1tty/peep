import { Mat4, Vec3, DEG } from './math';
import { rayIntersectVoxel } from './raycaster';

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
    this.state.distance = Math.max(0.5, Math.min(200, this.state.distance + delta));
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

  /**
   * Sims-Voxel: переводит 2D-клик в 3D-луч и возвращает блок и грань.
   * screenX, screenY — координаты в viewport (например clientX, clientY).
   * Возвращает { x, y, z, face } или null.
   */
  pickVoxel(
    screenX: number,
    screenY: number,
    grid: Uint8Array,
    sx: number,
    sy?: number,
    sz?: number,
  ): { x: number; y: number; z: number; face: import('./types').FaceNormal } | null {
    const Sy = sy ?? sx;
    const Sz = sz ?? sx;
    const rect = this.root.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const px = screenX - cx;
    const py = screenY - cy;
    const pz = -this._perspectivePx;
    const view = this.camera.getViewMatrix(this._voxelSize);
    const invView = view.invert();
    const m = invView.m;
    const ox = m[12];
    const oy = m[13];
    const oz = m[14];
    const dx = m[0] * px + m[4] * py + m[8] * pz;
    const dy = m[1] * px + m[5] * py + m[9] * pz;
    const dz = m[2] * px + m[6] * py + m[10] * pz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const s = this._voxelSize;
    return rayIntersectVoxel(
      ox / s, oy / s, oz / s,
      dx / len, dy / len, dz / len,
      grid, sx, Sy, Sz,
    );
  }

  destroy() {
    this.root.remove();
  }
}
