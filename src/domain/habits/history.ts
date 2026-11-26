// Data preparation for charts and the habit detail view. Pure: give it habits,
// logs (already attributed — see rewardLogs() in game.ts) and a clock.
import { STATS, type StatId } from '../../config/stats.ts';
import { allHabitRewards } from '../rules/rewards.ts';
import { makeSeason, seasonFor, seasonIdOfResult } from '../seasons/calendar.ts';
import { addDays, periodStart, toDateKey } from '../time.ts';
import type { Currency, Habit, HabitKind, HabitLog, LedgerEntry, PeriodResult } from '../types.ts';
import { closedResults, currentProgress } from './evaluate.ts';

export interface HistoryBar extends PeriodResult {
  /** Target of the habit version that scored this period. */
  target: number;
  kind: HabitKind;
  /** The current period: shown, but not scored yet. */
  open: boolean;
}

export type HistoryRange = 'recent' | 'season' | 'year';

/** Closed results of every version in a chain, oldest first. */
export function chainResults(chain: Habit[], logs: HabitLog[], now: Date): (PeriodResult & { habit: Habit })[] {
  return chain
    .flatMap((h) => closedResults(h, logs, now).map((r) => ({ ...r, habit: h })))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Bars for the habit chart: closed periods in range plus the open one at the end.
 * `recent` = the last 8 periods (7 closed + the open one).
 */
export function periodHistory(chain: Habit[], logs: HabitLog[], now: Date, range: HistoryRange): HistoryBar[] {
  const head = chain[chain.length - 1];
  if (!head) return [];
  const closed: HistoryBar[] = chainResults(chain, logs, now).map(({ habit, ...r }) => ({
    ...r, target: habit.target, kind: habit.kind, open: false,
  }));
  const open: HistoryBar = { ...currentProgress(head, logs, now), target: head.target, kind: head.kind, open: true };
  if (range === 'recent') return [...closed.slice(-7), open];
  const from = (range === 'season' ? seasonFor(now).start : new Date(now.getFullYear(), 0, 1)).getTime();
  return [...closed.filter((b) => new Date(b.start).getTime() >= from), open];
}

/** Consecutive achieved closed periods: the run ending at the latest one, and the longest ever. */
export function streaks(results: Pick<PeriodResult, 'achieved'>[]): { current: number; best: number } {
  let run = 0;
  let best = 0;
  for (const r of results) {
    run = r.achieved ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current: run, best };
}

export interface HabitStats {
  closedPeriods: number;
  completionRate: number | null; // 0..1, null before the first period closes
  averagePerPeriod: number | null;
  /** Highest-scoring closed period (latest wins a tie). */
  bestPeriod: PeriodResult | null;
  totalLogged: number;
}

export function habitStats(chain: Habit[], logs: HabitLog[], now: Date): HabitStats {
  const results = chainResults(chain, logs, now);
  const ids = new Set(chain.map((h) => h.id));
  const mine = uniqueLogs(logs.filter((l) => ids.has(l.habitId)));
  const n = results.length;
  return {
    closedPeriods: n,
    completionRate: n ? results.filter((r) => r.achieved).length / n : null,
    averagePerPeriod: n ? results.reduce((s, r) => s + r.total, 0) / n : null,
    bestPeriod: results.reduce<PeriodResult | null>((b, r) => (!b || r.score >= b.score ? r : b), null),
    totalLogged: mine.reduce((s, l) => s + l.amount, 0),
  };
}

/** Attributed logs can appear once per version; collapse them back to stored logs. */
export function uniqueLogs(logs: HabitLog[]): HabitLog[] {
  const seen = new Set<string>();
  return logs.filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
}

export interface HeatCell {
  date: string; // YYYY-MM-DD
  /** Week column (0 = the week holding Jan 1) and weekday row (0 = Monday). */
  col: number;
  row: number;
  total: number;
  /** 0 = nothing logged, 1–4 = quartile of the busiest day. */
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
  /** Daily habits only: the day missed its target (build) or broke the limit. */
  missed: boolean;
}

/** One cell per day of `year`, weeks as columns. */
export function heatmap(chain: Habit[], logs: HabitLog[], year: number, now: Date): { cells: HeatCell[]; weeks: number; max: number } {
  const ids = new Set(chain.map((h) => h.id));
  const totals = new Map<string, number>();
  for (const l of uniqueLogs(logs.filter((x) => ids.has(x.habitId)))) {
    const k = toDateKey(new Date(l.at));
    totals.set(k, (totals.get(k) ?? 0) + l.amount);
  }
  const max = Math.max(0, ...[...totals].filter(([k]) => k.startsWith(`${year}-`)).map(([, v]) => v));
  const first = periodStart(new Date(year, 0, 1), 'weekly');
  const today = toDateKey(now);
  const cells: HeatCell[] = [];
  for (let d = new Date(year, 0, 1); d.getFullYear() === year; d = addDays(d, 1)) {
    const date = toDateKey(d);
    const total = totals.get(date) ?? 0;
    const future = date > today;
    // Only closed days of a daily version that was active from the start of that day are judged.
    let version: Habit | undefined;
    for (const h of chain) if (new Date(h.createdAt) <= d) version = h;
    const judged = version?.period === 'daily' && date < today;
    const missed = judged ? (version!.kind === 'build' ? total < version!.target : total > version!.target) : false;
    cells.push({
      date,
      col: Math.round((periodStart(d, 'weekly').getTime() - first.getTime()) / (7 * 86_400_000)),
      row: (d.getDay() + 6) % 7,
      total,
      level: total <= 0 || max <= 0 ? 0 : (Math.min(4, Math.ceil((total / max) * 4)) as 1 | 2 | 3 | 4),
      future,
      missed,
    });
  }
  return { cells, weeks: cells[cells.length - 1].col + 1, max };
}

/** Mondays from the week containing `from` up to `until` (exclusive). */
export function weekStarts(from: Date, until: Date): Date[] {
  const out: Date[] = [];
  for (let w = periodStart(from, 'weekly'); w < until; w = addDays(w, 7)) out.push(w);
  return out;
}

export interface SeasonRange {
  id: string;
  start: Date;
  /** Exclusive; capped at `now` for the running season. */
  end: Date;
}

export function seasonRange(seasonId: string, now: Date): SeasonRange {
  const [y, s] = seasonId.split('-S').map(Number);
  const season = makeSeason(y, s as 1 | 2 | 3 | 4);
  return { id: seasonId, start: season.start, end: season.end < now ? season.end : now };
}

/**
 * Cumulative XP per stat at the end of each week of a season, from rewards that
 * landed in that season. Weeks are clipped to the season.
 */
export function seasonStatGrowth(habits: Habit[], logs: HabitLog[], now: Date, seasonId: string) {
  const range = seasonRange(seasonId, now);
  const rewards = allHabitRewards(habits, logs, now)
    .map((r) => r.reward)
    .filter((r) => seasonIdOfResult(r.result) === seasonId);
  const weeks = weekStarts(range.start, range.end).map((w) => {
    const end = addDays(w, 7) < range.end ? addDays(w, 7) : range.end;
    return { start: w < range.start ? range.start : w, end };
  });
  const series = Object.fromEntries(STATS.map((s) => [s, [] as number[]])) as Record<StatId, number[]>;
  for (const w of weeks) {
    const t = w.end.getTime();
    const upTo = rewards.filter((r) => new Date(r.result.end).getTime() <= t);
    for (const s of STATS) series[s].push(upTo.reduce((sum, r) => sum + (r.xp[s] ?? 0), 0));
  }
  return { weeks, series };
}

export interface BalancePoint {
  date: Date; // end of day
  balance: number;
  /** Net spending that day (positive number), so drops can be labelled. */
  spent: number;
  earned: number;
}

/** Daily running balance of one currency across a range, starting from the balance before it. */
export function balanceHistory(ledger: LedgerEntry[], currency: Currency, from: Date, until: Date): BalancePoint[] {
  const entries = ledger.filter((e) => e.currency === currency);
  let bal = entries.filter((e) => new Date(e.at) < from).reduce((s, e) => s + e.amount, 0);
  const out: BalancePoint[] = [];
  for (let d = periodStart(from, 'daily'); d < until; d = addDays(d, 1)) {
    const next = addDays(d, 1);
    const day = entries.filter((e) => {
      const t = new Date(e.at);
      return t >= d && t < next && t >= from;
    });
    const earned = day.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const spent = -day.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);
    bal += earned - spent;
    out.push({ date: d, balance: bal, earned, spent });
  }
  return out;
}

export interface WeekCompletion {
  start: Date;
  /** Closed periods (any habit) that ended during this week. */
  periods: number;
  achieved: number;
  rate: number | null;
}

/** Share of habit periods met, by the week they closed in. */
export function weeklyCompletion(habits: Habit[], logs: HabitLog[], now: Date, from: Date, until: Date): WeekCompletion[] {
  const results = habits.flatMap((h) => closedResults(h, logs, now));
  return weekStarts(from, until).map((start) => {
    const s = start.getTime();
    const e = addDays(start, 7).getTime();
    const inWeek = results.filter((r) => {
      const t = new Date(r.end).getTime();
      return t > s && t <= e;
    });
    const achieved = inWeek.filter((r) => r.achieved).length;
    return { start, periods: inWeek.length, achieved, rate: inWeek.length ? achieved / inWeek.length : null };
  });
}
