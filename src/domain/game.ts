// Facade: combines stored data + clock into everything the UI needs.
// The UI should call these rather than reaching into individual modules.
import type { Encounter } from './encounters/generator.ts';
import { freezeCharacter, viewCharacter, type CharacterView } from './character/stats.ts';
import { balance, encounterGoldAllowance, habitLedger } from './economy/ledger.ts';
import type { StatId } from '../config/stats.ts';
import { attributeLogs, chainHeads, chainOf } from './habits/chain.ts';
import { allHabitRewards } from './rules/rewards.ts';
import { closedResults } from './habits/evaluate.ts';
import { seasonFor } from './seasons/calendar.ts';
import { addDays } from './time.ts';
import type { Character, CharacterSnapshot, Habit, HabitLog, LedgerEntry, RealReward, StatXp } from './types.ts';

export interface SavedEncounter {
  id: string;
  title: string;
  savedAt: string;
  /** The full generated encounter, so it replays exactly even after generator changes. */
  encounter: Encounter;
  /** The party as it was when fought. */
  party: CharacterSnapshot[];
}

export interface Settings {
  /** Leave test logs (made while the dev clock was shifted) out of rewards while the clock is real. */
  excludeTestLogs: boolean;
}

export interface AppData {
  schemaVersion: 3;
  userId: string;
  habits: Habit[];
  logs: HabitLog[];
  characters: Character[];
  /** Non-habit entries only (encounters, bosses, shop, redemptions). */
  ledger: LedgerEntry[];
  realRewards: RealReward[];
  inventory: string[];
  /** Date keys / boss ids already fought, so each can be done once. */
  completedEncounters: string[];
  savedEncounters: SavedEncounter[];
  devOffsetDays: number;
  settings: Settings;
}

export function emptyData(): AppData {
  return {
    schemaVersion: 3,
    userId: crypto.randomUUID(),
    habits: [],
    logs: [],
    characters: [],
    ledger: [],
    realRewards: [
      { id: 'takeaway', name: 'Takeaway night', cost: 50 },
      { id: 'game', name: 'New video game', cost: 200 },
    ],
    inventory: [],
    completedEncounters: [],
    savedEncounters: [],
    devOffsetDays: 0,
    settings: { excludeTestLogs: true },
  };
}

/**
 * Logs that count toward rewards. Test logs are left out while the clock is real
 * (if the setting is on) and always counted while the dev clock is shifted, so
 * boss and season testing still works.
 */
export function countedLogs(d: Pick<AppData, 'logs' | 'settings' | 'devOffsetDays'>): HabitLog[] {
  const includeTest = !d.settings.excludeTestLogs || d.devOffsetDays !== 0;
  return includeTest ? d.logs : d.logs.filter((l) => !l.test);
}

const attributed = new WeakMap<AppData, HabitLog[]>();

/**
 * The logs every rules-engine call should use: counted logs, attributed to habit
 * versions (see habits/chain.ts). Cached per AppData object.
 */
export function rewardLogs(d: AppData): HabitLog[] {
  let logs = attributed.get(d);
  if (!logs) {
    logs = attributeLogs(d.habits, countedLogs(d));
    attributed.set(d, logs);
  }
  return logs;
}

export function fullLedger(d: AppData, now: Date): LedgerEntry[] {
  return [...habitLedger(d.habits, rewardLogs(d), now), ...d.ledger];
}

export function wallet(d: AppData, now: Date) {
  const l = fullLedger(d, now);
  const gold = balance(l, 'gold');
  const tokens = balance(l, 'tokens');
  return {
    /** Shown balances never go below 0 (a rebalance can push the real ledger negative). */
    gold: Math.max(0, gold),
    tokens: Math.max(0, tokens),
    /** The real ledger balances; buying needs these to cover the cost. */
    rawGold: gold,
    rawTokens: tokens,
    encounterGoldLeft: encounterGoldAllowance(l, now),
  };
}

export function currentCharacter(d: AppData, now: Date): Character | undefined {
  const sid = seasonFor(now).id;
  return d.characters.find((c) => c.seasonId === sid);
}

export function currentCharacterView(d: AppData, now: Date): CharacterView | undefined {
  const c = currentCharacter(d, now);
  return c ? viewCharacter(c, d.habits, rewardLogs(d), now) : undefined;
}

/** Average score of periods that closed in the last 7 days (0 if none). */
export function recentScore(d: AppData, now: Date): number {
  const since = addDays(now, -7).getTime();
  const results = d.habits
    .flatMap((h) => closedResults(h, rewardLogs(d), now))
    .filter((r) => new Date(r.end).getTime() >= since);
  if (!results.length) return 0;
  return results.reduce((s, r) => s + r.score, 0) / results.length;
}

/** Characters from a given year with frozen snapshots — the Final Boss party pool. */
export function archivedPartyForYear(d: AppData, year: number) {
  return d.characters.filter((c) => c.seasonId.startsWith(`${year}-`) && c.snapshot).map((c) => c.snapshot!);
}

/**
 * Everyone who can join this year's Final Boss: archived S1–S3 characters,
 * plus the current Season 4 character (frozen as they are right now).
 */
export function finalBossParty(d: AppData, now: Date): CharacterSnapshot[] {
  const year = now.getFullYear();
  const party = archivedPartyForYear(d, year);
  const view = currentCharacterView(d, now);
  if (view && view.character.seasonId === `${year}-S4`) party.push(freezeCharacter(view, now));
  return party;
}

/**
 * Freezes characters whose season has ended. Call on app start and on every clock change.
 * Returns updated data (or the same object if nothing changed).
 */
export function archiveEndedSeasons(d: AppData, now: Date): AppData {
  const currentId = seasonFor(now).id;
  let changed = false;
  const characters = d.characters.map((c) => {
    const [y, s] = c.seasonId.split('-S').map(Number);
    const seasonEnd = new Date(y, s * 3, 1);
    const ended = now >= seasonEnd;
    // The dev clock was moved back into this season: thaw it (snapshots are derived, so nothing is lost).
    if (c.snapshot && !ended) {
      changed = true;
      const { snapshot: _thawed, ...live } = c;
      return { ...live, equipment: c.snapshot.equipment };
    }
    if (c.snapshot || !ended || c.seasonId === currentId) return c;
    // Freeze at the moment the season ended, so later logs don't count.
    const view = viewCharacter(c, d.habits, rewardLogs(d), seasonEnd);
    changed = true;
    return { ...c, snapshot: freezeCharacter(view, seasonEnd) };
  });
  return changed ? { ...d, characters } : d;
}

export interface RewardTotals {
  xp: StatXp;
  gold: number;
  tokens: number;
}

/** Everything habits have earned so far, in total and per habit chain (keyed by the current name). */
export function habitRewardTotals(d: AppData, now: Date): { total: RewardTotals; byHabit: Map<string, RewardTotals> } {
  const heads = new Map(chainHeads(d.habits).flatMap((head) => chainOf(d.habits, head.id).map((v) => [v.id, head.name] as const)));
  const total: RewardTotals = { xp: {}, gold: 0, tokens: 0 };
  const byHabit = new Map<string, RewardTotals>();
  for (const { habit, reward } of allHabitRewards(d.habits, rewardLogs(d), now)) {
    const name = heads.get(habit.id) ?? habit.name;
    const h = byHabit.get(name) ?? { xp: {}, gold: 0, tokens: 0 };
    byHabit.set(name, h);
    for (const t of [total, h]) {
      t.gold += reward.gold;
      t.tokens += reward.tokens;
      for (const [stat, amount] of Object.entries(reward.xp) as [StatId, number][]) t.xp[stat] = (t.xp[stat] ?? 0) + amount;
    }
  }
  return { total, byHabit };
}

/** after − before, keeping only the non-zero parts. Returns undefined if nothing changed. */
export function diffRewardTotals(before: RewardTotals, after: RewardTotals): RewardTotals | undefined {
  const xp: StatXp = {};
  for (const s of new Set([...Object.keys(before.xp), ...Object.keys(after.xp)]) as Set<StatId>) {
    const delta = (after.xp[s] ?? 0) - (before.xp[s] ?? 0);
    if (delta) xp[s] = delta;
  }
  const gold = after.gold - before.gold;
  const tokens = after.tokens - before.tokens;
  return Object.keys(xp).length || gold || tokens ? { xp, gold, tokens } : undefined;
}
