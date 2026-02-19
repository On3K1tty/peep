export interface VoxelData {
  x: number;
  y: number;
  z: number;
  color: string;
}

export interface MergedFace {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  normal: FaceNormal;
  color: string;
}

export type FaceNormal = 'top' | 'bottom' | 'front' | 'back' | 'right' | 'left';

export interface EngineOptions {
  container: string | HTMLElement;
  voxelSize?: number;
  perspective?: number;
}

export interface SceneNode {
  readonly el: HTMLElement;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  update(): void;
  destroy(): void;
}

export const enum BlockRole {
  SOLID = 0,
  DEADLY = 1,
  BOUNCY = 2,
  PICKUP = 3,
  SPAWN = 4,
  FINISH = 5,
  MOVER = 6,
  PORTAL = 7,
}

export const ROLE_NAMES = ['solid', 'deadly', 'bouncy', 'pickup', 'spawn', 'finish', 'mover', 'portal'] as const;

export interface GameSave {
  v: 1;
  /** Cubic: number (e.g. 32). Rectangular: [sx, sy, sz] (e.g. [128, 32, 128]). */
  size: number | [number, number, number];
  grid: number[];    // RLE-compressed block indices
  roles: number[];   // RLE-compressed roles
  palette: string[]; // color hex strings
  triggers: TriggerDef[];
  moverPaths: Record<string, [number, number, number][]>;
  portalTargets: Record<string, [number, number, number]>;
  name?: string;
}

export interface TriggerDef {
  id: number;
  type: 'touch' | 'click' | 'timer' | 'score_gte';
  target?: [number, number, number];
  action: 'destroy' | 'teleport' | 'text' | 'sound' | 'win' | 'lose' | 'spawn_block';
  params: Record<string, any>;
}
