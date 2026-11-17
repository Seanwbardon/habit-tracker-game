// Character stats = class base + this season's habit XP (+ gear in combat).
import { getClass } from '../../config/classes.ts';
import { REWARDS } from '../../config/rewards.ts';
import { STATS, type StatId } from '../../config/stats.ts';
import { allHabitRewards, sumXp } from '../rules/rewards.ts';
import { seasonIdOfResult } from '../seasons/calendar.ts';
import type { Character, CharacterSnapshot, Habit, HabitLog, StatXp } from '../types.ts';

export function seasonXp(habits: Habit[], logs: HabitLog[], seasonId: string, now: Date): StatXp {
  const rewards = allHabitRewards(habits, logs, now)
    .map((r) => r.reward)
    .filter((r) => seasonIdOfResult(r.result) === seasonId);
  return sumXp(rewards);
}

export function computeStats(classId: string, xp: StatXp): Record<StatId, number> {
  const cls = getClass(classId);
  const out = {} as Record<StatId, number>;
  for (const s of STATS) {
    out[s] = cls.baseStats[s] + Math.floor((xp[s] ?? 0) / REWARDS.xpPerStatPoint);
  }
  return out;
}

export function totalXp(xp: StatXp): number {
  return Object.values(xp).reduce((a, b) => a + (b ?? 0), 0);
}

export function levelFor(xp: StatXp): number {
  return 1 + Math.floor(totalXp(xp) / REWARDS.xpPerLevel);
}

/** Progress through the current level, for the XP bar. */
export function levelProgress(xp: StatXp): { level: number; current: number; needed: number } {
  return {
    level: levelFor(xp),
    current: totalXp(xp) % REWARDS.xpPerLevel,
    needed: REWARDS.xpPerLevel,
  };
}

export interface CharacterView {
  character: Character;
  xp: StatXp;
  stats: Record<StatId, number>;
  level: number;
}

/** Live view of a character — or its frozen snapshot if the season is over. */
export function viewCharacter(c: Character, habits: Habit[], logs: HabitLog[], now: Date): CharacterView {
  if (c.snapshot) {
    return { character: c, xp: {}, stats: c.snapshot.stats, level: c.snapshot.level };
  }
  const xp = seasonXp(habits, logs, c.seasonId, now);
  return { character: c, xp, stats: computeStats(c.classId, xp), level: levelFor(xp) };
}

export function freezeCharacter(view: CharacterView, now: Date): CharacterSnapshot {
  const c = view.character;
  return {
    characterId: c.id,
    seasonId: c.seasonId,
    name: c.name,
    classId: c.classId,
    level: view.level,
    stats: { ...view.stats },
    equipment: [...c.equipment],
    frozenAt: now.toISOString(),
  };
}
