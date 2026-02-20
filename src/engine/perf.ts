/** PS1 baseline: FPS/DOM count / bundle weight gates. */

let _frameCount = 0;
let _lastFpsTime = 0;
let _fps = 0;

export function perfTick() {
  _frameCount++;
  const now = performance.now();
  if (now - _lastFpsTime >= 1000) {
    _fps = _frameCount;
    _frameCount = 0;
    _lastFpsTime = now;
  }
}

export function getFps(): number { return _fps; }
export function getDomCount(): number { return document.getElementsByTagName('*').length; }

export const GATES = {
  FPS_MIN: 30,
  BUNDLE_MAX_KB: 500,
  BUNDLE_MAX_GZIP_KB: 500,
} as const;
