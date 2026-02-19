export class Vec3 {
  constructor(public x = 0, public y = 0, public z = 0) {}

  set(x: number, y: number, z: number): this {
    this.x = x; this.y = y; this.z = z;
    return this;
  }

  copy(v: Vec3): this {
    this.x = v.x; this.y = v.y; this.z = v.z;
    return this;
  }

  add(v: Vec3): Vec3 {
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  sub(v: Vec3): Vec3 {
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  scale(s: number): Vec3 {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }

  len(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize(): Vec3 {
    const l = this.len() || 1;
    return new Vec3(this.x / l, this.y / l, this.z / l);
  }

  dot(v: Vec3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v: Vec3): Vec3 {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x,
    );
  }

  clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }
}

/**
 * Column-major 4x4 matrix stored as Float64Array[16].
 * Index layout matches WebGL/CSS matrix3d convention:
 *   [m0  m4  m8   m12]
 *   [m1  m5  m9   m13]
 *   [m2  m6  m10  m14]
 *   [m3  m7  m11  m15]
 */
export class Mat4 {
  m: Float64Array;

  constructor() {
    this.m = new Float64Array(16);
    this.m[0] = this.m[5] = this.m[10] = this.m[15] = 1;
  }

  static identity(): Mat4 {
    return new Mat4();
  }

  static perspective(fov: number, aspect: number, near: number, far: number): Mat4 {
    const r = new Mat4();
    const d = r.m;
    const f = 1 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    d.fill(0);
    d[0] = f / aspect;
    d[5] = f;
    d[10] = (far + near) * nf;
    d[11] = -1;
    d[14] = 2 * far * near * nf;
    return r;
  }

  static translation(x: number, y: number, z: number): Mat4 {
    const r = new Mat4();
    r.m[12] = x; r.m[13] = y; r.m[14] = z;
    return r;
  }

  static rotationX(rad: number): Mat4 {
    const r = new Mat4();
    const c = Math.cos(rad), s = Math.sin(rad);
    r.m[5] = c; r.m[6] = s;
    r.m[9] = -s; r.m[10] = c;
    return r;
  }

  static rotationY(rad: number): Mat4 {
    const r = new Mat4();
    const c = Math.cos(rad), s = Math.sin(rad);
    r.m[0] = c; r.m[2] = -s;
    r.m[8] = s; r.m[10] = c;
    return r;
  }

  static rotationZ(rad: number): Mat4 {
    const r = new Mat4();
    const c = Math.cos(rad), s = Math.sin(rad);
    r.m[0] = c; r.m[1] = s;
    r.m[4] = -s; r.m[5] = c;
    return r;
  }

  static scaling(x: number, y: number, z: number): Mat4 {
    const r = new Mat4();
    r.m[0] = x; r.m[5] = y; r.m[10] = z;
    return r;
  }

  multiply(b: Mat4): Mat4 {
    const r = new Mat4();
    const a = this.m, bm = b.m, o = r.m;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        o[j * 4 + i] =
          a[i] * bm[j * 4] +
          a[4 + i] * bm[j * 4 + 1] +
          a[8 + i] * bm[j * 4 + 2] +
          a[12 + i] * bm[j * 4 + 3];
      }
    }
    return r;
  }

  invert(): Mat4 {
    const m = this.m, r = new Mat4(), inv = r.m;

    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return r;
    det = 1 / det;

    inv[0]  = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    inv[1]  = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    inv[2]  = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    inv[3]  = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    inv[4]  = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    inv[5]  = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    inv[6]  = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    inv[7]  = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    inv[8]  = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    inv[9]  = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    inv[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    inv[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    inv[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    inv[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    inv[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    inv[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

    return r;
  }

  /** Convert to CSS matrix3d() string */
  toCSS(): string {
    const m = this.m;
    return `matrix3d(${m[0]},${m[1]},${m[2]},${m[3]},${m[4]},${m[5]},${m[6]},${m[7]},${m[8]},${m[9]},${m[10]},${m[11]},${m[12]},${m[13]},${m[14]},${m[15]})`;
  }

  transformPoint(v: Vec3): Vec3 {
    const m = this.m;
    const w = m[3] * v.x + m[7] * v.y + m[11] * v.z + m[15] || 1;
    return new Vec3(
      (m[0] * v.x + m[4] * v.y + m[8]  * v.z + m[12]) / w,
      (m[1] * v.x + m[5] * v.y + m[9]  * v.z + m[13]) / w,
      (m[2] * v.x + m[6] * v.y + m[10] * v.z + m[14]) / w,
    );
  }
}

export const DEG = Math.PI / 180;
