/**
 * Sims-Voxel: процедурный шум для фактуры вокселей.
 * Шум-банк: 4 вариации 64×64, генерируются один раз при загрузке.
 */

const NOISE_SIZE = 64;
const NOISE_COUNT = 4;

let _noiseUrls: string[] | null = null;

function genNoiseCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = NOISE_SIZE;
  c.height = NOISE_SIZE;
  const ctx = c.getContext('2d')!;
  const id = ctx.createImageData(NOISE_SIZE, NOISE_SIZE);
  for (let i = 0; i < id.data.length; i += 4) {
    const g = 128 + (Math.random() * 64 - 32);
    id.data[i] = id.data[i + 1] = id.data[i + 2] = g;
    id.data[i + 3] = 255; /* градации 100–155 дают мягкий grain при overlay */
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

export function getNoiseBank(): string[] {
  if (_noiseUrls) return _noiseUrls;
  _noiseUrls = [];
  for (let i = 0; i < NOISE_COUNT; i++) {
    _noiseUrls.push(genNoiseCanvas().toDataURL('image/png'));
  }
  return _noiseUrls;
}

export function pickNoiseSeed(x: number, y: number, z: number): number {
  return Math.abs((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) % NOISE_COUNT;
}

/** Микро-рандом цвета: baseColor +/- 2% для вариативности. */
export function varyColor(hex: string, seed: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  const rand = (i: number) => (Math.sin(seed * 12.9898 + i) * 43758.5453) % 1;
  const d = 0.02;
  const nr = Math.round(Math.max(0, Math.min(255, r * (1 + (rand(0) * 2 - 1) * d))));
  const ng = Math.round(Math.max(0, Math.min(255, g * (1 + (rand(1) * 2 - 1) * d))));
  const nb = Math.round(Math.max(0, Math.min(255, b * (1 + (rand(2) * 2 - 1) * d))));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}
