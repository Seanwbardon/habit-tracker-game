// Habit edit chains. A reward-affecting edit never rewrites history: the old
// version is archived at a cutoff and a new linked version starts there.
// Logs keep their stored habitId; attributeLogs() decides, at evaluation time,
// which version(s) of a chain each log counts for.
import { periodStart } from '../time.ts';
import type { Habit, HabitLog } from '../types.ts';

/** Fields that change how a habit is scored or rewarded (unit is included on purpose). */
export const VERSIONED_FIELDS = ['kind', 'target', 'unit', 'period', 'primaryStat', 'secondaryStat', 'difficulty'] as const;

export type HabitPatch = Partial<Pick<Habit, 'name' | (typeof VERSIONED_FIELDS)[number]>>;

/** Every version of the habit `habitId` belongs to, oldest first. */
export function chainOf(habits: Habit[], habitId: string): Habit[] {
  const byId = new Map(habits.map((h) => [h.id, h]));
  const next = new Map(habits.filter((h) => h.previousHabitId).map((h) => [h.previousHabitId!, h]));
  let head = byId.get(habitId);
  if (!head) return [];
  while (next.has(head.id)) head = next.get(head.id)!;
  const out: Habit[] = [];
  for (let h: Habit | undefined = head; h; h = h.previousHabitId ? byId.get(h.previousHabitId) : undefined) out.unshift(h);
  return out;
}

/** The newest version of each chain. */
export function chainHeads(habits: Habit[]): Habit[] {
  const replaced = new Set(habits.map((h) => h.previousHabitId).filter(Boolean));
  return habits.filter((h) => !replaced.has(h.id));
}

/**
 * The time range whose logs a version may see. The first version sees everything
 * before its archive time. Later versions start at the beginning of the period
 * their createdAt falls in, so when the period type gets longer (daily → weekly)
 * logs from earlier in the same week still count toward the new target.
 */
export function logWindow(h: Habit): { start: number; end: number } {
  return {
    start: h.previousHabitId ? periodStart(new Date(h.createdAt), h.period).getTime() : -Infinity,
    end: h.archivedAt ? new Date(h.archivedAt).getTime() : Infinity,
  };
}

/**
 * Re-labels chain logs so each version sees the logs in its window (a log may
 * count for two versions in the overlap described above). Habits without a chain
 * pass through unchanged. Idempotent.
 */
export function attributeLogs(habits: Habit[], logs: HabitLog[]): HabitLog[] {
  const chains = new Map<string, Habit[]>();
  for (const h of habits) {
    if (chains.has(h.id)) continue;
    const chain = chainOf(habits, h.id);
    for (const v of chain) chains.set(v.id, chain);
  }
  const out: HabitLog[] = [];
  const seen = new Set<string>();
  const push = (l: HabitLog) => {
    const key = `${l.id}|${l.habitId}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(l);
    }
  };
  for (const l of logs) {
    const chain = chains.get(l.habitId);
    if (!chain || chain.length === 1) {
      push(l);
      continue;
    }
    const t = new Date(l.at).getTime();
    for (const v of chain) {
      const w = logWindow(v);
      if (t >= w.start && t < w.end) push(v.id === l.habitId ? l : { ...l, habitId: v.id });
    }
  }
  return out;
}

/**
 * When a reward-affecting edit takes effect: the latest of the current period's
 * start under the old rules, under the new rules, and the old version's creation.
 * Closed periods therefore never change; the open period is rescored.
 */
export function editCutoff(old: Habit, next: Pick<Habit, 'period'>, now: Date): Date {
  return new Date(
    Math.max(
      periodStart(now, old.period).getTime(),
      periodStart(now, next.period).getTime(),
      new Date(old.createdAt).getTime(),
    ),
  );
}

/**
 * Applies an edit. Name-only changes (and any edit made before the old version has
 * earned anything) update in place; otherwise the old version is archived at the
 * cutoff and a linked new version is appended.
 */
export function editHabit(habits: Habit[], habitId: string, patch: HabitPatch, now: Date, makeId: () => string): Habit[] {
  const old = habits.find((h) => h.id === habitId);
  if (!old) return habits;
  const next: Habit = { ...old, ...patch };
  const versioned = VERSIONED_FIELDS.some((f) => next[f] !== old[f]);
  const cutoff = editCutoff(old, next, now);
  if (!versioned || cutoff.getTime() <= new Date(old.createdAt).getTime()) {
    return habits.map((h) => (h.id === habitId ? next : h));
  }
  const at = cutoff.toISOString();
  const created: Habit = { ...next, id: makeId(), createdAt: at, previousHabitId: old.id, archivedAt: undefined };
  delete created.archivedAt;
  return [...habits.map((h) => (h.id === habitId ? { ...old, archivedAt: at } : h)), created];
}
