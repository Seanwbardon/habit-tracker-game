// Daily encounters, generated from a seed of (user, date).
// Bump GENERATOR_VERSION whenever the generation logic changes, and keep
// saved encounters as the full generated object so old favourites replay exactly.
import { ENEMIES, LOOT } from '../../config/enemies.ts';
import type { Combatant } from '../combat/engine.ts';
import { hashString, makeRng } from './rng.ts';

export const GENERATOR_VERSION = 1;

export interface Encounter {
  id: string;
  kind: 'daily' | 'season-boss' | 'final-boss';
  generatorVersion: number;
  seed: number;
  dateKey: string;
  enemies: Combatant[];
  /** Gold offered before the encounter cap is applied. */
  gold: number;
  loot: string[];
}

export interface DailyEncounterInput {
  userId: string;
  dateKey: string; // "2027-01-15"
  level: number;
  /** Average habit score over the last 7 days (0..1.25). Better habits → better loot. */
  recentScore: number;
}

export function generateDailyEncounter(input: DailyEncounterInput): Encounter {
  const seed = hashString(`${input.userId}|${input.dateKey}|daily|v${GENERATOR_VERSION}`);
  const rng = makeRng(seed);
  const scale = 1 + (input.level - 1) * 0.15;
  // Up to 2 enemies early on, 3 from level 4.
  const count = rng.int(1, Math.min(3, 1 + Math.ceil(input.level / 3)));

  const enemies: Combatant[] = [];
  for (let i = 0; i < count; i++) {
    const t = rng.pickWeighted(ENEMIES);
    const hp = Math.round(t.hp * scale);
    enemies.push({
      id: `enemy-${i}`,
      name: count > 1 ? `${t.name} ${String.fromCharCode(65 + i)}` : t.name,
      side: 'enemy',
      maxHp: hp,
      hp,
      maxMp: 0,
      mp: 0,
      atk: Math.round(t.atk * scale),
      mag: 0,
      heal: 0,
      def: Math.round(t.def * scale),
      spd: t.spd,
      crit: 0.05,
      defending: false,
    });
  }

  const loot: string[] = [];
  const lootChance = 0.25 + 0.4 * Math.min(1, input.recentScore);
  if (rng.next() < lootChance) loot.push(rng.pickWeighted(LOOT).id);

  return {
    id: `daily-${input.dateKey}`,
    kind: 'daily',
    generatorVersion: GENERATOR_VERSION,
    seed,
    dateKey: input.dateKey,
    enemies,
    gold: 10 * count + rng.int(0, 10),
    loot,
  };
}
