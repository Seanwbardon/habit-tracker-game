// Turns raw logs into period results. Pure functions — no storage, no clock.
import { REWARDS } from '../../config/rewards.ts';
import { closedPeriodStarts, periodEnd, periodKey, periodStart } from '../time.ts';
import type { Habit, HabitLog, PeriodResult } from '../types.ts';

export function totalInRange(logs: HabitLog[], habitId: string, start: Date, end: Date): number {
  const s = start.getTime();
  const e = end.getTime();
  return logs
    .filter((l) => l.habitId === habitId)
    .filter((l) => {
      const t = new Date(l.at).getTime();
      return t >= s && t < e;
    })
    .reduce((sum, l) => sum + l.amount, 0);
}

/** Score 0..scoreCap for a period total. */
export function scorePeriod(habit: Habit, total: number): { score: number; achieved: boolean } {
  const { scoreCap, limitHeadroomBonus, buildMinRatio } = REWARDS;

  if (habit.kind === 'build') {
    const ratio = habit.target > 0 ? total / habit.target : 1;
    if (ratio < buildMinRatio) return { score: 0, achieved: false };
    return { score: Math.min(scoreCap, ratio), achieved: ratio >= 1 };
  }

  // limit: staying at or under the target is success; more headroom = more reward.
  if (total > habit.target) return { score: 0, achieved: false };
  const headroom = (habit.target - total) / Math.max(habit.target, 1);
  return { score: Math.min(scoreCap, 1 + headroom * limitHeadroomBonus), achieved: true };
}

export function evaluatePeriod(habit: Habit, logs: HabitLog[], start: Date): PeriodResult {
  const end = periodEnd(start, habit.period);
  const total = totalInRange(logs, habit.id, start, end);
  const { score, achieved } = scorePeriod(habit, total);
  return {
    habitId: habit.id,
    periodKey: periodKey(start, habit.period),
    start: start.toISOString(),
    end: end.toISOString(),
    total,
    score,
    achieved,
  };
}

/** Every finished period for a habit, from creation up to (not including) the current one. */
export function closedResults(habit: Habit, logs: HabitLog[], now: Date): PeriodResult[] {
  const until = habit.archivedAt && new Date(habit.archivedAt) < now ? new Date(habit.archivedAt) : now;
  return closedPeriodStarts(new Date(habit.createdAt), until, habit.period).map((s) =>
    evaluatePeriod(habit, logs, s),
  );
}

/** Live progress for the current period (not yet rewarded). */
export function currentProgress(habit: Habit, logs: HabitLog[], now: Date): PeriodResult {
  return evaluatePeriod(habit, logs, periodStart(now, habit.period));
}
