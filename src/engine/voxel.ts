import { Mat4, DEG } from './math';
import type { MergedFace, FaceNormal, SceneNode } from './types';
import { greedyMeshGrid } from './mesher';

const FACE_BRIGHTNESS: Record<FaceNormal, number> = {
  top: 1.0,
  front: 0.85,
  back: 0.7,
  right: 0.8,
  left: 0.75,
  bottom: 0.6,
};

export class WorldMesh implements SceneNode {
  readonly el: HTMLElement;
  position = { x: 0, y: 0, z: 0 };
  rotation = { x: 0, y: 0, z: 0 };
  scale = { x: 1, y: 1, z: 1 };

  private _faceEls: HTMLElement[] = [];
  private _voxelSize: number;
  private _faceCount = 0;

  constructor(voxelSize = 16) {
    this._voxelSize = voxelSize;
    this.el = document.createElement('div');
    this.el.style.position = 'absolute';
    this.el.style.transformStyle = 'preserve-3d';
    this.el.style.willChange = 'transform';
  }

  get faceCount() { return this._faceCount; }

  rebuildFromGrid(grid: Uint8Array, palette: string[], sx: number, sy?: number, sz?: number) {
    const faces = greedyMeshGrid(grid, palette, sx, sy, sz);
    this._faceCount = faces.length;

    for (const el of this._faceEls) el.remove();
    this._faceEls.length = 0;

    const s = this._voxelSize;
    for (const face of faces) {
      const div = document.createElement('div');
      const fw = face.w * s;
      const fh = face.h * s;

      div.className = 'vf';
      div.style.cssText =
        `position:absolute;width:${fw}px;height:${fh}px;` +
        `backface-visibility:hidden;transform-origin:0 0;` +
        `image-rendering:pixelated;pointer-events:auto;` +
        `background:${face.color};filter:brightness(${FACE_BRIGHTNESS[face.normal]})`;

      div.style.transform = faceTransform(face, s);
      div.dataset.n = face.normal;
      div.dataset.x = String(face.x);
      div.dataset.y = String(face.y);
      div.dataset.z = String(face.z);

      this.el.appendChild(div);
      this._faceEls.push(div);
    }
  }

  update() {
    const s = this._voxelSize;
    const t = Mat4.translation(
      this.position.x * s,
      -this.position.y * s,
      this.position.z * s,
    );
    const ry = Mat4.rotationY(this.rotation.y * DEG);
    this.el.style.transform = t.multiply(ry).toCSS();
  }

  destroy() {
    for (const el of this._faceEls) el.remove();
    this._faceEls.length = 0;
    this.el.remove();
  }
}

function faceTransform(f: MergedFace, s: number): string {
  const gx = f.x, gy = f.y, gz = f.z;
  switch (f.normal) {
    case 'top':
      return `translate3d(${gx * s}px,${-(gy + 1) * s}px,${gz * s}px) rotateX(90deg)`;
    case 'bottom':
      return `translate3d(${gx * s}px,${-gy * s}px,${(gz + f.h) * s}px) rotateX(-90deg)`;
    case 'front':
      return `translate3d(${gx * s}px,${-(gy + f.h) * s}px,${(gz + 1) * s}px)`;
    case 'back':
      return `translate3d(${(gx + f.w) * s}px,${-(gy + f.h) * s}px,${gz * s}px) rotateY(180deg)`;
    case 'right':
      return `translate3d(${(gx + 1) * s}px,${-(gy + f.h) * s}px,${(gz + f.w) * s}px) rotateY(90deg)`;
    case 'left':
      return `translate3d(${gx * s}px,${-(gy + f.h) * s}px,${gz * s}px) rotateY(-90deg)`;
  }
}
