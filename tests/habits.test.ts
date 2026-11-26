// Habit-tracking improvements: backfill, edit chains, test logs, streaks, history data.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closedResults, currentProgress } from '../src/domain/habits/evaluate.ts';
import { attributeLogs, chainHeads, chainOf, editCutoff, editHabit } from '../src/domain/habits/chain.ts';
import {
  balanceHistory, habitStats, heatmap, periodHistory, seasonStatGrowth, streaks, weeklyCompletion,
} from '../src/domain/habits/history.ts';
import { allHabitRewards } from '../src/domain/rules/rewards.ts';
import { countedLogs, diffRewardTotals, emptyData, habitRewardTotals, ledgerSourceTotals, rewardLogs, wallet, type AppData } from '../src/domain/game.ts';
import { migrate } from '../src/data/storage.ts';
import type { Habit, HabitLog, LedgerEntry } from '../src/domain/types.ts';

const D = (m: number, d: number, h = 12) => new Date(2027, m - 1, d, h);
const weekly: Habit = {
  id: 'study', name: 'Study', kind: 'build', target: 5, unit: 'hours', period: 'weekly',
  primaryStat: 'INT', secondaryStat: 'WIS', difficulty: 3, createdAt: new Date(2027, 0, 4).toISOString(),
};
const daily: Habit = { ...weekly, id: 'read', name: 'Read', target: 1, unit: 'chapters', period: 'daily' };
let n = 0;
const log = (habitId: string, at: Date, amount: number, extra: Partial<HabitLog> = {}): HabitLog => ({
  id: `l${n++}`, habitId, at: at.toISOString(), amount, ...extra,
});
const ids = () => { let i = 0; return () => `v${++i}`; };
const rewardsFor = (habits: Habit[], logs: HabitLog[], now: Date, habitId: string) =>
  allHabitRewards(habits, attributeLogs(habits, logs), now).filter((r) => r.habit.id === habitId).map((r) => r.reward);
const xpOf = (rs: { xp: Partial<Record<string, number>> }[]) =>
  rs.reduce((s, r) => s + Object.values(r.xp).reduce<number>((a, b) => a + (b ?? 0), 0), 0);

test('a backfilled log lands in the period of its date, not the day it was entered', () => {
  const now = D(1, 20); // Wed of week 3
  const logs = [log('study', D(1, 5), 3), log('study', D(1, 7), 2)]; // the second one backfilled today
  const results = closedResults(weekly, logs, now);
  assert.equal(results[0].periodKey, '2027-01-04/weekly');
  assert.equal(results[0].total, 5);
  assert.equal(results[0].achieved, true);
  assert.equal(currentProgress(weekly, logs, now).total, 0);
});

test('backfilling into a closed period changes that period\'s rewards on recalculation', () => {
  const now = D(1, 20);
  const before = xpOf(rewardsFor([weekly], [log('study', D(1, 5), 3)], now, 'study'));
  const after = xpOf(rewardsFor([weekly], [log('study', D(1, 5), 3), log('study', D(1, 8), 2)], now, 'study'));
  assert.ok(after > before);
});

test('name-only edits update in place', () => {
  const habits = editHabit([weekly], 'study', { name: 'Deep study' }, D(2, 3), ids());
  assert.equal(habits.length, 1);
  assert.equal(habits[0].name, 'Deep study');
  assert.equal(habits[0].id, 'study');
});

test('reward-affecting edits archive the old version and keep its closed periods', () => {
  const now = D(1, 21); // Thursday of week 3
  const habits = editHabit([weekly], 'study', { target: 10 }, now, ids());
  assert.equal(habits.length, 2);
  const [old, next] = habits;
  assert.equal(old.archivedAt, new Date(2027, 0, 18).toISOString()); // this Monday
  assert.equal(next.previousHabitId, 'study');
  assert.equal(next.createdAt, old.archivedAt);
  assert.deepEqual(chainOf(habits, 'study').map((h) => h.id), ['study', 'v1']);
  assert.deepEqual(chainHeads(habits).map((h) => h.id), ['v1']);

  // 5 hours in each of weeks 1 and 2 (met under target 5), 6 hours this week.
  const logs = [log('study', D(1, 5), 5), log('study', D(1, 12), 5), log('study', D(1, 19), 6)];
  const later = D(2, 1); // week 3 has closed
  const att = attributeLogs(habits, logs);
  const oldResults = closedResults(old, att, later);
  assert.deepEqual(oldResults.map((r) => r.achieved), [true, true]); // old weeks keep the old target
  const newResults = closedResults(next, att, later);
  assert.equal(newResults[0].periodKey, '2027-01-18/weekly');
  assert.equal(newResults[0].total, 6); // logs made before the edit still count this week…
  assert.equal(newResults[0].achieved, false); // …but against the new target
  // Old-period rewards are identical to never having edited.
  const unedited = rewardsFor([weekly], logs, later, 'study').filter((r) => r.result.end <= old.archivedAt!);
  assert.equal(xpOf(rewardsFor(habits, logs, later, 'study')), xpOf(unedited));
});

test('daily → weekly: closed days stay, the week counts earlier days toward the target but does not re-pay them', () => {
  const now = D(1, 21, 9); // Thursday
  const habits = editHabit([daily], 'read', { period: 'weekly', target: 4 }, now, ids());
  const [old, next] = habits;
  assert.equal(old.archivedAt, new Date(2027, 0, 21).toISOString()); // cutoff = today, not Monday
  const logs = [18, 19, 20, 21].map((d) => log('read', D(1, d), 1));
  const later = D(1, 25);
  const att = attributeLogs(habits, logs);
  assert.equal(closedResults(old, att, later).filter((r) => r.start >= new Date(2027, 0, 18).toISOString()).length, 3);
  const week = closedResults(next, att, later)[0];
  assert.equal(week.total, 4);
  assert.equal(week.achieved, true);
  const drips = rewardsFor(habits, logs, later, next.id).filter((r) => r.result.periodKey.endsWith('-progress'));
  assert.deepEqual(drips.map((r) => r.result.start), [new Date(2027, 0, 21).toISOString()]); // only days from the cutoff
});

test('the edit cutoff never moves before the old version was created', () => {
  const h: Habit = { ...weekly, createdAt: new Date(2027, 0, 21).toISOString() }; // created Thursday
  assert.equal(editCutoff(h, h, D(1, 23)).toISOString(), h.createdAt);
  // …so a second edit in the same period just updates in place
  assert.equal(editHabit([h], 'study', { target: 9 }, D(1, 23), ids()).length, 1);
});

test('test logs are left out of rewards while the clock is real, counted while it is shifted', () => {
  const base: AppData = { ...emptyData(), habits: [weekly] };
  const logs = [log('study', D(1, 5), 5, { test: true }), log('study', D(1, 6), 1)];
  const real = { ...base, logs };
  assert.equal(countedLogs(real).length, 1);
  assert.equal(countedLogs({ ...real, devOffsetDays: 10 }).length, 2);
  assert.equal(countedLogs({ ...real, settings: { excludeTestLogs: false } }).length, 2);
  const now = D(1, 20);
  assert.ok(wallet({ ...real, devOffsetDays: 10 }, now).rawGold > wallet(real, now).rawGold);
  assert.equal(rewardLogs(real), rewardLogs(real)); // cached per data object
});

test('shown balances never go below zero, but the raw balance is kept', () => {
  const d: AppData = { ...emptyData(), ledger: [{ id: 'x', currency: 'gold', amount: -40, source: 'shop', ref: 'sword', at: D(1, 5).toISOString() }] };
  const w = wallet(d, D(1, 6));
  assert.equal(w.gold, 0);
  assert.equal(w.rawGold, -40);
});

test('v2 saves migrate to v3 with default settings', () => {
  const d = migrate({ schemaVersion: 2, habits: [], logs: [] });
  assert.equal(d.schemaVersion, 3);
  assert.deepEqual(d.settings, { excludeTestLogs: true });
});

test('streaks count consecutive achieved periods', () => {
  const s = (xs: boolean[]) => streaks(xs.map((achieved) => ({ achieved })));
  assert.deepEqual(s([]), { current: 0, best: 0 });
  assert.deepEqual(s([true, true, false, true, true, true, false]), { current: 0, best: 3 });
  assert.deepEqual(s([false, true, true]), { current: 2, best: 2 });
});

test('streaks and history follow an edit chain as one habit', () => {
  const habits = editHabit([weekly], 'study', { target: 3 }, D(1, 20), ids());
  const logs = [log('study', D(1, 5), 5), log('study', D(1, 12), 5), log('study', D(1, 19), 3), log('v1', D(1, 26), 3)];
  const now = D(2, 3);
  const chain = chainOf(habits, 'v1');
  const bars = periodHistory(chain, attributeLogs(habits, logs), now, 'recent');
  assert.deepEqual(bars.map((b) => b.target), [5, 5, 3, 3, 3]);
  assert.deepEqual(bars.map((b) => b.open), [false, false, false, false, true]);
  assert.deepEqual(streaks(bars.filter((b) => !b.open)), { current: 4, best: 4 });
});

test('period history ranges', () => {
  const logs = [log('read', D(3, 30), 1)];
  const now = D(4, 3); // Season 2 started Apr 1
  assert.equal(periodHistory([daily], logs, now, 'recent').length, 8);
  assert.deepEqual(periodHistory([daily], logs, now, 'season').map((b) => b.start), [1, 2, 3].map((d) => new Date(2027, 3, d).toISOString()));
  assert.equal(periodHistory([daily], logs, now, 'year').length, 31 + 28 + 31 + 2 + 1 - 3); // created Jan 4
});

test('habit stats', () => {
  const logs = [log('study', D(1, 5), 5), log('study', D(1, 12), 2), log('study', D(1, 19), 1)];
  const s = habitStats([weekly], logs, D(1, 20));
  assert.equal(s.closedPeriods, 2);
  assert.equal(s.completionRate, 0.5);
  assert.equal(s.averagePerPeriod, 3.5);
  assert.equal(s.bestPeriod?.periodKey, '2027-01-04/weekly');
  assert.equal(s.totalLogged, 8);
  assert.equal(habitStats([weekly], [], D(1, 5)).completionRate, null);
});

test('heatmap: one cell per day, weeks as columns from Monday, missed days flagged for daily habits', () => {
  const logs = [log('read', D(1, 4), 2), log('read', D(1, 4, 18), 2), log('read', D(1, 6), 1)];
  const { cells, weeks, max } = heatmap([daily], logs, 2027, D(1, 8));
  assert.equal(cells.length, 365);
  assert.equal(weeks, 53); // Jan 1 2027 is a Friday
  assert.deepEqual([cells[0].col, cells[0].row], [0, 4]);
  const jan4 = cells.find((c) => c.date === '2027-01-04')!;
  assert.deepEqual([jan4.col, jan4.row, jan4.total, jan4.level], [1, 0, 4, 4]);
  assert.equal(max, 4);
  assert.equal(cells.find((c) => c.date === '2027-01-06')!.level, 1);
  assert.equal(cells.find((c) => c.date === '2027-01-05')!.missed, true);
  assert.equal(cells.find((c) => c.date === '2027-01-08')!.missed, false); // today: not judged yet
  assert.equal(cells.find((c) => c.date === '2027-01-09')!.future, true);
});

test('weekly completion rate across habits', () => {
  const logs = [log('read', D(1, 4), 1), log('read', D(1, 5), 1), log('study', D(1, 6), 5)];
  const weeks = weeklyCompletion([daily, weekly], logs, D(1, 13), new Date(2027, 0, 4), D(1, 13));
  assert.equal(weeks.length, 2);
  assert.deepEqual([weeks[0].periods, weeks[0].achieved], [8, 3]); // 7 days + 1 week
  assert.equal(weeks[1].periods, 2); // Mon + Tue of week 2 closed so far

  // A range starting mid-week clips the first week and ignores periods that closed before it.
  const clipped = weeklyCompletion([daily], logs, D(1, 13), new Date(2027, 0, 7), D(1, 13));
  assert.equal(clipped[0].start.getTime(), new Date(2027, 0, 7).getTime());
  assert.equal(clipped[0].periods, 4); // Jan 7–10 (ending Jan 8–11)
});

test('season stat growth is cumulative by week', () => {
  const logs = [log('study', D(1, 5), 5), log('study', D(1, 12), 5)];
  const { weeks, series } = seasonStatGrowth([weekly], logs, D(1, 20), '2027-S1');
  assert.equal(weeks[0].start.getTime(), new Date(2027, 0, 1).getTime()); // clipped to the season
  for (let i = 1; i < series.INT.length; i++) assert.ok(series.INT[i] >= series.INT[i - 1]);
  assert.ok(series.INT.at(-1)! > series.WIS.at(-1)!);
  assert.equal(series.STR.at(-1), 0);
});

test('balance history shows spending as drops', () => {
  const e = (day: number, amount: number): LedgerEntry => ({
    id: `${day}${amount}`, currency: 'gold', amount, source: amount > 0 ? 'encounter' : 'shop', ref: '', at: D(1, day).toISOString(),
  });
  const pts = balanceHistory([e(1, 10), e(3, 20), e(4, -15), e(4, 5)], 'gold', new Date(2027, 0, 2), new Date(2027, 0, 5));
  assert.deepEqual(pts.map((p) => p.balance), [10, 30, 20]);
  assert.deepEqual([pts[2].spent, pts[2].earned], [15, 5]);
});

test('reward totals diff shows how much each reward went up', () => {
  const now = D(1, 20);
  const before: AppData = { ...emptyData(), habits: [weekly], logs: [log('study', D(1, 5), 3)] };
  const after: AppData = { ...before, logs: [...before.logs, log('study', D(1, 6), 2)] }; // backfill completes week 1
  const a = habitRewardTotals(before, now);
  const b = habitRewardTotals(after, now);
  const d = diffRewardTotals(a.total, b.total)!;
  assert.ok(d.xp.INT! > 0 && d.xp.WIS! > 0 && d.gold > 0 && d.tokens > 0);
  assert.equal(d.xp.STR, undefined); // unchanged stats are left out
  assert.deepEqual(diffRewardTotals(b.byHabit.get('Study')!, b.byHabit.get('Study')!), undefined);
});

test('ledger totals by source cover encounter and shop Gold', () => {
  const e = (source: LedgerEntry['source'], currency: LedgerEntry['currency'], amount: number): LedgerEntry =>
    ({ id: `${source}${amount}`, source, currency, amount, ref: '', at: D(1, 5).toISOString() });
  const t = ledgerSourceTotals({ ledger: [e('encounter', 'gold', 12), e('encounter', 'gold', 3), e('shop', 'gold', -30), e('redeem', 'tokens', -50), e('boss', 'gold', 40)] });
  assert.deepEqual(t.encounter, { gold: 15, tokens: 0 });
  assert.deepEqual(t.shop, { gold: -30, tokens: 0 });
  assert.deepEqual(t.redeem, { gold: 0, tokens: -50 });
  assert.equal(t.boss.gold, 40);
});
