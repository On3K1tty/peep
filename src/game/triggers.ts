import type { TriggerDef } from '../engine/types';
import type { PlayerState } from './player';
import type { World } from './world';

export type TriggerEvent = {
  type: 'text'; text: string;
} | {
  type: 'sound'; sound: string;
} | {
  type: 'win';
} | {
  type: 'lose';
} | {
  type: 'teleport'; x: number; y: number; z: number;
};

export class TriggerRuntime {
  private _fired = new Set<number>();
  private _timers = new Map<number, number>();

  reset() {
    this._fired.clear();
    this._timers.clear();
  }

  evaluate(
    triggers: TriggerDef[],
    player: PlayerState,
    world: World,
    dt: number,
  ): TriggerEvent[] {
    const events: TriggerEvent[] = [];

    for (const t of triggers) {
      if (this._fired.has(t.id)) continue;

      let conditionMet = false;

      switch (t.type) {
        case 'touch':
          if (t.target) {
            const px = Math.floor(player.x);
            const py = Math.floor(player.y);
            const pz = Math.floor(player.z);
            const [tx, ty, tz] = t.target;
            conditionMet = (px === tx && (py === ty || py + 1 === ty) && pz === tz);
          }
          break;

        case 'click':
          // Click triggers are evaluated externally via checkClick()
          break;

        case 'timer': {
          const elapsed = (this._timers.get(t.id) ?? 0) + dt;
          this._timers.set(t.id, elapsed);
          conditionMet = elapsed >= (t.params.seconds ?? 10);
          break;
        }

        case 'score_gte':
          conditionMet = player.score >= (t.params.score ?? 1);
          break;
      }

      if (conditionMet) {
        this._fired.add(t.id);
        const evt = this._executeAction(t, player, world);
        if (evt) events.push(evt);
      }
    }

    return events;
  }

  checkClick(
    triggers: TriggerDef[],
    bx: number, by: number, bz: number,
    player: PlayerState,
    world: World,
  ): TriggerEvent[] {
    const events: TriggerEvent[] = [];
    for (const t of triggers) {
      if (t.type !== 'click' || this._fired.has(t.id)) continue;
      if (t.target && t.target[0] === bx && t.target[1] === by && t.target[2] === bz) {
        this._fired.add(t.id);
        const evt = this._executeAction(t, player, world);
        if (evt) events.push(evt);
      }
    }
    return events;
  }

  private _executeAction(
    t: TriggerDef,
    player: PlayerState,
    world: World,
  ): TriggerEvent | null {
    switch (t.action) {
      case 'text':
        return { type: 'text', text: t.params.text ?? '' };
      case 'sound':
        return { type: 'sound', sound: t.params.sound ?? 'pickup' };
      case 'win':
        player.won = true;
        return { type: 'win' };
      case 'lose':
        player.alive = false;
        return { type: 'lose' };
      case 'teleport':
        if (t.params.x != null) {
          player.x = t.params.x + 0.5;
          player.y = t.params.y;
          player.z = t.params.z + 0.5;
          return { type: 'teleport', x: t.params.x, y: t.params.y, z: t.params.z };
        }
        return null;
      case 'destroy':
        if (t.target) world.clear(t.target[0], t.target[1], t.target[2]);
        return { type: 'sound', sound: 'explode' };
      case 'spawn_block':
        if (t.params.x != null) {
          world.set(t.params.x, t.params.y, t.params.z, t.params.blockId ?? 1);
        }
        return { type: 'sound', sound: 'pickup' };
    }
    return null;
  }
}
