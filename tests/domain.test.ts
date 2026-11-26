// Run with: npm test   (uses Node's built-in test runner, no extra installs)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closedResults, scorePeriod } from '../src/domain/habits/evaluate.ts';
import { rewardFor, previewHabitReward } from '../src/domain/rules/rewards.ts';
import { periodStart, toDateKey } from '../src/domain/time.ts';
import { seasonFor, isInBossWindow, isFinalBossAvailable } from '../src/domain/seasons/calendar.ts';
import { finalBossScaling, finalBossEncounter } from '../src/domain/seasons/bosses.ts';
import { generateDailyEncounter } from '../src/domain/encounters/generator.ts';
import { combatantFromStats, createBattle, replay, step, activeMember } from '../src/domain/combat/engine.ts';
import { habitLedger, balance, encounterGoldAllowance } from '../src/domain/economy/ledger.ts';
import { computeStats, seasonXp } from '../src/domain/character/stats.ts';
import { archiveEndedSeasons, emptyData } from '../src/domain/game.ts';
import type { CharacterSnapshot, Habit, HabitLog } from '../src/domain/types.ts';

const study: Habit = {
  id: 'study', name: 'Study', kind: 'build', target: 5, unit: 'hours', period: 'weekly',
  primaryStat: 'INT', secondaryStat: 'WIS', difficulty: 3, createdAt: new Date(2027, 0, 4).toISOString(),
};
const smoking: Habit = {
  id: 'smoke', name: 'Smoking', kind: 'limit', target: 2, unit: 'cigarettes', period: 'weekly',
  primaryStat: 'CON', secondaryStat: 'WIS', difficulty: 4, createdAt: new Date(2027, 0, 4).toISOString(),
};
const log = (habitId: string, d: Date, amount: number): HabitLog => ({ id: `${habitId}-${d.getTime()}`, habitId, at: d.toISOString(), amount });

test('weeks start on Monday', () => {
  assert.equal(toDateKey(periodStart(new Date(2027, 0, 10), 'weekly')), '2027-01-04'); // Sunday → Monday before
  assert.equal(toDateKey(periodStart(new Date(2027, 0, 11), 'weekly')), '2027-01-11');
});

test('build habit scoring', () => {
  assert.deepEqual(scorePeriod(study, 5), { score: 1, achieved: true });
  assert.equal(scorePeriod(study, 2.5).achieved, false);
  assert.equal(scorePeriod(study, 1).score, 0); // below minimum ratio
  assert.equal(scorePeriod(study, 50).score, 1.25); // capped
});

test('limit habit scoring rewards headroom, never negative', () => {
  assert.equal(scorePeriod(smoking, 2).achieved, true);
  assert.ok(scorePeriod(smoking, 0).score > scorePeriod(smoking, 2).score);
  assert.deepEqual(scorePeriod(smoking, 5), { score: 0, achieved: false });
});

test('rewards split 70/30 between primary and secondary', () => {
  const p = previewHabitReward(study);
  assert.ok(p.primaryXp > p.secondaryXp);
  const r = rewardFor(study, { habitId: 'study', periodKey: 'x', start: '', end: '', total: 0, score: 0, achieved: false });
  assert.deepEqual([r.gold, r.tokens], [0, 0]); // a missed week earns nothing and costs nothing
});

test('only closed periods are rewarded, and tokens need the target met', () => {
  const logs = [log('study', new Date(2027, 0, 5), 3), log('study', new Date(2027, 0, 6), 2), log('study', new Date(2027, 0, 12), 1)];
  const now = new Date(2027, 0, 13); // second week still open
  const results = closedResults(study, logs, now);
  assert.equal(results.length, 1);
  assert.equal(results[0].achieved, true);
  const ledger = habitLedger([study], logs, now);
  assert.ok(balance(ledger, 'gold') > 0);
  assert.ok(balance(ledger, 'tokens') > 0);
});

test('stats come from class base + season XP', () => {
  const logs = [log('study', new Date(2027, 0, 5), 10), log('study', new Date(2027, 0, 12), 10), log('study', new Date(2027, 0, 19), 10)];
  const xp = seasonXp([study], logs, '2027-S1', new Date(2027, 0, 30));
  const stats = computeStats('mage', xp);
  assert.ok(stats.INT > 9);
});

test('seasons align to the calendar with a 7-day boss window', () => {
  assert.equal(seasonFor(new Date(2027, 4, 1)).id, '2027-S2');
  assert.equal(isInBossWindow(new Date(2027, 2, 26)), true);
  assert.equal(isInBossWindow(new Date(2027, 2, 20)), false);
  assert.equal(isFinalBossAvailable(new Date(2027, 11, 28)), true);
  assert.equal(isFinalBossAvailable(new Date(2027, 2, 28)), false);
});

test('Final Boss scales down for smaller parties', () => {
  const snap = (id: string): CharacterSnapshot => ({
    characterId: id, seasonId: '2027-S1', name: id, classId: 'warrior', level: 5,
    stats: { STR: 12, DEX: 8, INT: 8, CON: 12, WIS: 8, CHA: 8 }, equipment: [], frozenAt: '',
  });
  const one = finalBossScaling([snap('a')]);
  const four = finalBossScaling([snap('a'), snap('b'), snap('c'), snap('d')]);
  assert.ok(one.strength < four.strength);
  assert.ok(one.rewardFactor < four.rewardFactor);
  assert.ok(finalBossEncounter(2027, [snap('a')]).enemies[0].hp < finalBossEncounter(2027, [snap('a'), snap('b')]).enemies[0].hp);

  // party level/stats don't affect the boss — only the number of characters
  const strong: CharacterSnapshot = { ...snap('s'), level: 20, stats: { STR: 30, DEX: 30, INT: 30, CON: 30, WIS: 30, CHA: 30 } };
  assert.equal(finalBossScaling([strong]).strength, one.strength);
  assert.deepEqual(finalBossEncounter(2027, [strong]).enemies[0].maxHp, finalBossEncounter(2027, [snap('s')]).enemies[0].maxHp);
});

test('daily encounters are deterministic per user + date', () => {
  const input = { userId: 'u1', dateKey: '2027-02-01', level: 3, recentScore: 1 };
  assert.deepEqual(generateDailyEncounter(input), generateDailyEncounter(input));
  assert.notDeepEqual(generateDailyEncounter(input), generateDailyEncounter({ ...input, dateKey: '2027-02-02' }));
});

test('battles replay identically from the same actions', () => {
  const hero = combatantFromStats('hero', 'Hero', { STR: 10, DEX: 8, INT: 6, CON: 10, WIS: 6, CHA: 5 });
  const enc = generateDailyEncounter({ userId: 'u1', dateKey: '2027-02-01', level: 1, recentScore: 0.5 });
  let state = createBattle([hero], enc.enemies, enc.seed);
  const actions = [];
  while (state.outcome === 'ongoing' && actions.length < 200) {
    const me = activeMember(state)!;
    const target = state.enemies.find((e) => e.hp > 0)!;
    const a = { type: 'attack' as const, actorId: me.id, targetId: target.id };
    actions.push(a);
    state = step(state, a);
  }
  assert.notEqual(state.outcome, 'ongoing');
  assert.deepEqual(replay(createBattle([hero], enc.enemies, enc.seed), actions), state);
});

test('encounter gold is capped by recent habit gold', () => {
  const now = new Date(2027, 0, 20);
  const ledger = [
    { id: '1', currency: 'gold' as const, amount: 100, source: 'habit' as const, ref: '', at: new Date(2027, 0, 18).toISOString() },
    { id: '2', currency: 'gold' as const, amount: 15, source: 'encounter' as const, ref: '', at: new Date(2027, 0, 19).toISOString() },
  ];
  assert.equal(encounterGoldAllowance(ledger, now), 5); // 20% of 100, minus 15 already earned
});

test('ended seasons freeze their character', () => {
  const d = { ...emptyData(), habits: [study], characters: [{ id: 'c1', seasonId: '2027-S1', name: 'Ayla', classId: 'mage', createdAt: '', equipment: [] }] };
  const after = archiveEndedSeasons(d, new Date(2027, 3, 2));
  assert.ok(after.characters[0].snapshot);
  assert.equal(archiveEndedSeasons(d, new Date(2027, 1, 1)), d); // nothing to freeze mid-season
});

test('daily habits pay each day, plus a big bonus for a perfect Mon–Sun week', () => {
  const water: Habit = {
    id: 'water', name: 'Water', kind: 'build', target: 1, unit: 'litres', period: 'daily',
    primaryStat: 'CON', secondaryStat: 'WIS', difficulty: 1, createdAt: new Date(2027, 0, 4).toISOString(), // Monday
  };
  const days = (n: number, skip?: number) =>
    Array.from({ length: n }, (_, i) => i).filter((i) => i !== skip).map((i) => log('water', new Date(2027, 0, 4 + i, 12), 1));
  const now = new Date(2027, 0, 12); // week of Jan 4 is closed
  const gold = (logs: HabitLog[]) => balance(habitLedger([water], logs, now), 'gold');
  const xp = (logs: HabitLog[]) => Object.values(seasonXp([water], logs, '2027-S1', now)).reduce((a, b) => a + b, 0);

  const perfect = days(7);
  const missedOne = days(7, 3);
  assert.equal(xp(missedOne), 6 * 12); // 6 days × (10 base + 20% completion)
  assert.equal(xp(perfect), 7 * 12 + 50); // 7 days + perfect-week bonus
  assert.ok(gold(perfect) > gold(missedOne) * 1.5);

  // a habit created mid-week can't earn that week's bonus
  const lateStart = { ...water, createdAt: new Date(2027, 0, 6).toISOString() };
  assert.equal(Object.values(seasonXp([lateStart], perfect, '2027-S1', now)).reduce((a, b) => a + b, 0), 5 * 12);
});

test('weekly habits pay out daily as you progress, plus a big bonus when the week is met', () => {
  // study: 5h/week, difficulty 3 → base 120 XP
  const logs = [log('study', new Date(2027, 0, 4, 12), 2), log('study', new Date(2027, 0, 5, 12), 3)];
  const total = (now: Date) => Object.values(seasonXp([study], logs, '2027-S1', now)).reduce((a, b) => a + b, 0);

  assert.equal(total(new Date(2027, 0, 5)), 48); // Monday closed: 2/5 of 120, mid-week
  assert.equal(total(new Date(2027, 0, 6)), 120); // Tuesday closed: target reached
  assert.equal(total(new Date(2027, 0, 11)), 240); // week closed: +120 completion bonus
  const tokensMidWeek = balance(habitLedger([study], logs, new Date(2027, 0, 6)), 'tokens');
  assert.equal(tokensMidWeek, 0); // tokens still wait for the target to be confirmed at week end
  assert.ok(balance(habitLedger([study], logs, new Date(2027, 0, 11)), 'tokens') > 0);
});

test('limit habits pay at period end: a share per clean day, nothing if over the limit', () => {
  const gold = (logs: HabitLog[], now: Date) => balance(habitLedger([smoking], logs, now), 'gold');
  const tokens = (logs: HabitLog[], now: Date) => balance(habitLedger([smoking], logs, now), 'tokens');
  const weekOver = new Date(2027, 0, 11); // week of Jan 4 has closed
  // Nothing lands mid-week, even on clean days.
  assert.equal(gold([], new Date(2027, 0, 7)), 0);
  // A clean week pays; a week with two logged days (still under the limit) pays less.
  const clean = gold([], weekOver);
  const twoDays = gold([log('smoke', new Date(2027, 0, 5, 12), 1), log('smoke', new Date(2027, 0, 6, 12), 1)], weekOver);
  assert.ok(clean > 0 && twoDays > 0 && twoDays < clean);
  assert.ok(tokens([], weekOver) > 0);
  // Going over the limit (3 > 2) forfeits the whole week, clean days included.
  const blown = [log('smoke', new Date(2027, 0, 9, 12), 3)];
  assert.equal(gold(blown, weekOver), 0);
  assert.equal(tokens(blown, weekOver), 0);
});
