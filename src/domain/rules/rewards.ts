// The rules engine: period results → XP, Gold and Tokens.
// Everything here is derived, so it can be recomputed at any time.
import { REWARDS } from '../../config/rewards.ts';
import type { StatId } from '../../config/stats.ts';
import { closedResults, totalInRange } from '../habits/evaluate.ts';
import { closedPeriodStarts, periodEnd, periodKey, periodStart } from '../time.ts';
import type { Habit, HabitLog, PeriodResult, PeriodReward, StatXp } from '../types.ts';

/** Full XP value of a perfectly completed period — shown when creating a habit. */
export function baseRewardXp(habit: Pick<Habit, 'period' | 'difficulty'>): number {
  return Math.round(REWARDS.baseXp[habit.period] * REWARDS.difficultyMultiplier[habit.difficulty]);
}

export function rewardFor(habit: Habit, result: PeriodResult): PeriodReward {
  const bonus = result.achieved ? 1 + REWARDS.completionBonus : 1;
  return splitReward(habit, result, Math.round(baseRewardXp(habit) * result.score * bonus));
}

/** Perfect-week bonus XP for a daily habit, scaled by difficulty. */
export function perfectWeekBonusXp(habit: Pick<Habit, 'difficulty'>): number {
  return Math.round(REWARDS.perfectWeekBonusXp * REWARDS.difficultyMultiplier[habit.difficulty]);
}

/**
 * For a daily habit, one bonus reward per closed Mon–Sun week in which every
 * one of the 7 days hit its target. Weeks the habit wasn't tracked for in full
 * (created or archived mid-week) don't qualify.
 */
export function perfectWeekRewards(habit: Habit, dailyResults: PeriodResult[]): PeriodReward[] {
  if (habit.period !== 'daily') return [];
  const byWeek = new Map<string, PeriodResult[]>();
  for (const r of dailyResults) {
    const key = periodKey(periodStart(new Date(r.start), 'weekly'), 'weekly');
    byWeek.set(key, [...(byWeek.get(key) ?? []), r]);
  }
  const out: PeriodReward[] = [];
  for (const [key, days] of byWeek) {
    if (days.length !== 7 || !days.every((d) => d.achieved)) continue;
    const start = periodStart(new Date(days[0].start), 'weekly');
    const result: PeriodResult = {
      habitId: habit.id,
      periodKey: key.replace(/\/weekly$/, '/perfect-week'),
      start: start.toISOString(),
      end: periodEnd(start, 'weekly').toISOString(),
      total: days.reduce((s, d) => s + d.total, 0),
      score: 1,
      achieved: true,
    };
    out.push(splitReward(habit, result, perfectWeekBonusXp(habit)));
  }
  return out;
}

/** XP for the end-of-period completion bonus on a weekly/monthly habit. */
export function periodCompletionBonusXp(habit: Pick<Habit, 'period' | 'difficulty'>): number {
  return Math.round(baseRewardXp(habit) * REWARDS.periodCompletionBonus);
}

/**
 * WEEKLY / MONTHLY habits.
 *  BUILD habits pay out every day: each closed day earns its share of the period's
 *    base XP (that day's progress toward the target, up to scoreCap). Days already
 *    earned are never taken back, even if the period is later missed.
 *  LIMIT habits pay when the period closes, and only if it closed at or under the
 *    limit: an equal share of base XP for each "clean" day (nothing logged), plus
 *    the headroom bonus. Days with something logged earn nothing, and a period that
 *    went over the limit earns nothing at all — so nothing is paid and taken back.
 *  Either way, when the period closes with the target met, a large completion bonus
 *  lands, and the period's Tokens are granted then (Tokens still need the target met).
 */
export function dripRewards(habit: Habit, logs: HabitLog[], now: Date): PeriodReward[] {
  if (habit.period === 'daily') return [];
  const base = baseRewardXp(habit);
  const until = habit.archivedAt && new Date(habit.archivedAt) < now ? new Date(habit.archivedAt) : now;
  const out: PeriodReward[] = [];
  const dripByPeriod = new Map<string, number>();

  for (const day of habit.kind === 'build' ? closedPeriodStarts(new Date(habit.createdAt), until, 'daily') : []) {
    const pStart = periodStart(day, habit.period);
    const dayEnd = periodEnd(day, 'daily');
    const before = totalInRange(logs, habit.id, pStart, day);
    const amount = totalInRange(logs, habit.id, day, dayEnd);
    const after = before + amount;

    const cap = habit.target * REWARDS.scoreCap;
    const share = habit.target > 0 ? Math.max(0, Math.min(after, cap) - Math.min(before, cap)) / habit.target : 0;
    const xp = Math.round(base * share);
    if (xp <= 0) continue;

    const pKey = periodKey(pStart, habit.period);
    dripByPeriod.set(pKey, (dripByPeriod.get(pKey) ?? 0) + xp);
    out.push(
      splitReward(habit, {
        habitId: habit.id,
        periodKey: `${periodKey(day, 'daily')}/${habit.period}-progress`,
        start: day.toISOString(),
        end: dayEnd.toISOString(),
        total: amount,
        score: share,
        achieved: false,
      }, xp),
    );
  }

  for (const result of closedResults(habit, logs, now)) {
    if (!result.achieved) continue;
    if (habit.kind === 'limit') {
      const clean = limitCleanDays(habit, logs, result);
      const xp = Math.round(base * clean.share);
      if (xp > 0) {
        dripByPeriod.set(result.periodKey, xp);
        out.push(splitReward(habit, {
          ...result, periodKey: `${result.periodKey}-clean-days`, total: clean.days, score: clean.share, achieved: false,
        }, xp));
      }
    }
    // limit habits: headroom under the limit is paid with the bonus
    const headroomXp = habit.kind === 'limit' ? Math.round(base * Math.max(0, result.score - 1)) : 0;
    const bonusXp = periodCompletionBonusXp(habit) + headroomXp;
    const periodXp = (dripByPeriod.get(result.periodKey) ?? 0) + bonusXp;
    out.push(splitReward(habit, { ...result, periodKey: `${result.periodKey}-complete` }, bonusXp, periodXp));
  }
  return out;
}

/**
 * Clean days (nothing logged) of a closed limit-habit period, counted from the
 * day the habit version was created. Each is worth 1/(days in the period).
 */
export function limitCleanDays(habit: Habit, logs: HabitLog[], result: PeriodResult): { days: number; share: number } {
  const pStart = new Date(result.start);
  const pEnd = new Date(result.end);
  const daysInPeriod = Math.round((pEnd.getTime() - pStart.getTime()) / 86_400_000);
  const from = periodStart(new Date(habit.createdAt), 'daily');
  let days = 0;
  for (let d = pStart < from ? from : pStart; d < pEnd; d = periodEnd(d, 'daily')) {
    if (totalInRange(logs, habit.id, d, periodEnd(d, 'daily')) === 0) days++;
  }
  return { days, share: days / daysInPeriod };
}

function splitReward(habit: Habit, result: PeriodResult, totalXp: number, tokenXp = totalXp): PeriodReward {
  const xp: StatXp = {};
  const primary = Math.round(totalXp * REWARDS.primaryShare);
  addXp(xp, habit.primaryStat, primary);
  addXp(xp, habit.secondaryStat, totalXp - primary);

  return {
    result,
    xp,
    gold: Math.round(totalXp * REWARDS.goldPerXp),
    tokens: result.achieved ? Math.round(tokenXp * REWARDS.tokensPerXp) : 0,
  };
}

function addXp(xp: StatXp, stat: StatId, amount: number): void {
  xp[stat] = (xp[stat] ?? 0) + amount;
}

/** All rewards earned from every closed period of every habit. */
export function allHabitRewards(habits: Habit[], logs: HabitLog[], now: Date): { habit: Habit; reward: PeriodReward }[] {
  return habits.flatMap((habit) => {
    const rewards =
      habit.period === 'daily'
        ? (() => {
            const results = closedResults(habit, logs, now);
            return [...results.map((r) => rewardFor(habit, r)), ...perfectWeekRewards(habit, results)];
          })()
        : dripRewards(habit, logs, now);
    return rewards.map((reward) => ({ habit, reward }));
  });
}

export function sumXp(rewards: PeriodReward[]): StatXp {
  const out: StatXp = {};
  for (const r of rewards) {
    for (const [stat, amount] of Object.entries(r.xp) as [StatId, number][]) {
      addXp(out, stat, amount);
    }
  }
  return out;
}

/** Previews what a habit would earn per period — for the creation form. */
export function previewHabitReward(habit: Pick<Habit, 'period' | 'difficulty' | 'primaryStat' | 'secondaryStat'>) {
  const daily = habit.period === 'daily';
  const full = daily
    ? Math.round(baseRewardXp(habit) * (1 + REWARDS.completionBonus))
    : baseRewardXp(habit) + periodCompletionBonusXp(habit);
  const primary = Math.round(full * REWARDS.primaryShare);
  return {
    primaryXp: primary,
    secondaryXp: full - primary,
    gold: Math.round(full * REWARDS.goldPerXp),
    tokens: Math.round(full * REWARDS.tokensPerXp),
    /** Extra XP for a perfect Mon–Sun week (daily habits only, else 0). */
    perfectWeekXp: daily ? perfectWeekBonusXp(habit) : 0,
    /** Weekly/monthly: XP paid out day by day as you progress (else 0). */
    progressXp: daily ? 0 : baseRewardXp(habit),
    /** Weekly/monthly: bonus XP when the period's target is met (else 0). */
    completionXp: daily ? 0 : periodCompletionBonusXp(habit),
  };
}
