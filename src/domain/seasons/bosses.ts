// Season bosses and the scalable year-end Final Boss.
import {
  FINAL_BOSS_BASE,
  FINAL_BOSS_PARTY_FACTOR,
  FINAL_BOSS_REWARD_FACTOR,
  SEASON_BOSS_BASE,
  SEASON_BOSS_NAMES,
} from '../../config/seasons.ts';
import type { Combatant } from '../combat/engine.ts';
import { hashString } from '../encounters/rng.ts';
import type { Encounter } from '../encounters/generator.ts';
import type { CharacterSnapshot, SeasonInfo } from '../types.ts';

function bossCombatant(name: string, hp: number, atk: number, def: number, spd: number): Combatant {
  return { id: 'boss', name, side: 'enemy', maxHp: hp, hp, maxMp: 0, mp: 0, atk, mag: 0, heal: 0, def, spd, crit: 0.08, defending: false };
}

export function seasonBossEncounter(season: SeasonInfo, level: number): Encounter {
  const scale = 1 + (level - 1) * 0.12;
  const b = SEASON_BOSS_BASE;
  return {
    id: `boss-${season.id}`,
    kind: 'season-boss',
    generatorVersion: 1,
    seed: hashString(`boss|${season.id}`),
    dateKey: season.id,
    enemies: [bossCombatant(SEASON_BOSS_NAMES[season.index], Math.round(b.hp * scale), Math.round(b.atk * scale), Math.round(b.def * scale), b.spd)],
    gold: b.gold,
    loot: [],
  };
}

export interface FinalBossScaling {
  partySize: number;
  strength: number; // multiplier applied to the boss
  rewardFactor: number;
}

/**
 * Scales the Final Boss for 1–4 characters.
 * Strength depends only on how many characters are in the party — not their
 * levels or stats — so levelling up always makes the fight easier.
 */
export function finalBossScaling(party: CharacterSnapshot[]): FinalBossScaling {
  const n = Math.max(1, Math.min(4, party.length));
  return {
    partySize: n,
    strength: FINAL_BOSS_PARTY_FACTOR[n],
    rewardFactor: FINAL_BOSS_REWARD_FACTOR[n],
  };
}

export function finalBossEncounter(year: number, party: CharacterSnapshot[]): Encounter {
  const sc = finalBossScaling(party);
  const b = FINAL_BOSS_BASE;
  // HP scales fully with strength; attack scales more gently so small parties aren't one-shot.
  const atkScale = 0.45 + 0.55 * sc.strength;
  return {
    id: `final-${year}`,
    kind: 'final-boss',
    generatorVersion: 1,
    seed: hashString(`final|${year}|${party.map((p) => p.characterId).join(',')}`),
    dateKey: String(year),
    enemies: [bossCombatant(b.name, Math.round(b.hp * sc.strength), Math.round(b.atk * atkScale), Math.round(b.def * atkScale), b.spd)],
    gold: Math.round(b.gold * sc.rewardFactor),
    loot: [],
  };
}
