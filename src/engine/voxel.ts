import { Mat4, DEG } from './math';
import type { MergedFace, FaceNormal, SceneNode } from './types';
import { greedyMeshGrid } from './mesher';
import { varyColor } from './noise';

const FACE_BRIGHTNESS: Record<FaceNormal, number> = {
  top: 1.0,
  front: 0.85,
  back: 0.7,
  right: 0.8,
  left: 0.75,
  bottom: 0.6,
};
const FACE_CLASS: Record<FaceNormal, string> = {
  top: 'vf-top',
  front: 'vf-front',
  back: 'vf-back',
  right: 'vf-right',
  left: 'vf-left',
  bottom: 'vf-bottom',
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
    const normIdx: Record<FaceNormal, number> = { top: 0, bottom: 1, front: 2, back: 3, left: 4, right: 5 };

    for (const face of faces) {
      const div = document.createElement('div');
      const fw = face.w * s;
      const fh = face.h * s;

      const seed = (face.x * 31 + face.y * 17 + face.z * 7 + normIdx[face.normal]) | 0;
      const baseColor = varyColor(face.color, seed);
      const brightness = FACE_BRIGHTNESS[face.normal];

      /* процедурный стиль: цвет + AO. Шум — единый SVG feTurbulence на .voxel-world */
      div.className = `vf vf-proc vf-base ${FACE_CLASS[face.normal]}`;
      div.style.setProperty('--vf-w', `${fw}px`);
      div.style.setProperty('--vf-h', `${fh}px`);
      div.style.setProperty('--vf-color', baseColor);
      div.style.setProperty('--vf-brightness', String(brightness));

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

/* Микро-нахлёст 1.005 (PS1-трюк): грани чуть больше, закрывают щели */
const SCALE = 1.005;
function faceTransform(f: MergedFace, s: number): string {
  const gx = f.x, gy = f.y, gz = f.z;
  let t: string;
  switch (f.normal) {
    case 'top':
      t = `translate3d(${gx * s}px,${-(gy + 1) * s}px,${gz * s}px) rotateX(90deg)`;
      break;
    case 'bottom':
      t = `translate3d(${gx * s}px,${-gy * s}px,${(gz + f.h) * s}px) rotateX(-90deg)`;
      break;
    case 'front':
      t = `translate3d(${gx * s}px,${-(gy + f.h) * s}px,${(gz + 1) * s}px)`;
      break;
    case 'back':
      t = `translate3d(${(gx + f.w) * s}px,${-(gy + f.h) * s}px,${gz * s}px) rotateY(180deg)`;
      break;
    case 'right':
      t = `translate3d(${(gx + 1) * s}px,${-(gy + f.h) * s}px,${(gz + f.w) * s}px) rotateY(90deg)`;
      break;
    case 'left':
      t = `translate3d(${gx * s}px,${-(gy + f.h) * s}px,${gz * s}px) rotateY(-90deg)`;
      break;
    default:
      t = '';
  }
  return t + ` scale(${SCALE})`;
}
