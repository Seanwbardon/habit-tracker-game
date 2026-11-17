// Core data model. Only Habit, HabitLog and the non-habit ledger entries
// are stored — XP, stats and habit income are always derived from logs.
import type { StatId } from '../config/stats.ts';

export type HabitKind = 'build' | 'limit';
export type Period = 'daily' | 'weekly' | 'monthly';
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface Habit {
  id: string;
  name: string;
  /** build = reach the target (study 5h/week); limit = stay at or under it (smoke ≤ 2/week). */
  kind: HabitKind;
  target: number;
  unit: string;
  period: Period;
  primaryStat: StatId;
  secondaryStat: StatId;
  difficulty: Difficulty;
  createdAt: string; // ISO
  archivedAt?: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  at: string; // ISO
  amount: number;
  note?: string;
}

export interface PeriodResult {
  habitId: string;
  periodKey: string; // e.g. "2027-01-04/weekly"
  start: string;
  end: string;
  total: number;
  /** 0..scoreCap — how well the period went. */
  score: number;
  achieved: boolean;
}

export type StatXp = Partial<Record<StatId, number>>;

export interface PeriodReward {
  result: PeriodResult;
  xp: StatXp;
  gold: number;
  tokens: number;
}

export type Currency = 'gold' | 'tokens';
export type LedgerSource = 'habit' | 'encounter' | 'boss' | 'shop' | 'redeem';

export interface LedgerEntry {
  id: string;
  currency: Currency;
  amount: number; // + earn, − spend
  source: LedgerSource;
  ref: string; // what caused it (periodKey, encounter id, reward id…)
  at: string;
}

/** A real-life reward the user defines, bought with Tokens. */
export interface RealReward {
  id: string;
  name: string;
  cost: number;
}

export interface SeasonInfo {
  id: string; // "2027-S1"
  year: number;
  index: 1 | 2 | 3 | 4;
  start: Date;
  end: Date; // exclusive
}

export interface Character {
  id: string;
  seasonId: string;
  name: string;
  classId: string;
  createdAt: string;
  /** Item ids equipped. */
  equipment: string[];
  /** Set when the season ends — frozen forever after. */
  snapshot?: CharacterSnapshot;
}

export interface CharacterSnapshot {
  characterId: string;
  seasonId: string;
  name: string;
  classId: string;
  level: number;
  stats: Record<StatId, number>;
  equipment: string[];
  frozenAt: string;
}
