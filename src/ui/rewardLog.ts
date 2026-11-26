// Dev-only console output: how Gold, Tokens and XP changed after a log, backfill,
// edit, period closing, dev-clock jump, encounter, boss, shop purchase or redemption.
import { diffRewardTotals, habitRewardTotals, ledgerSourceTotals, wallet, type AppData, type RewardTotals, type SourceTotals } from '../domain/game.ts';

export interface RewardSnapshot {
  habits: ReturnType<typeof habitRewardTotals>;
  sources: SourceTotals;
  balance: { gold: number; tokens: number };
}

export function rewardSnapshot(d: AppData, now: Date): RewardSnapshot {
  const w = wallet(d, now);
  return { habits: habitRewardTotals(d, now), sources: ledgerSourceTotals(d), balance: { gold: w.rawGold, tokens: w.rawTokens } };
}

const EMPTY: RewardTotals = { xp: {}, gold: 0, tokens: 0 };
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;
const LABEL: Record<keyof SourceTotals, string> = { encounter: 'encounter', boss: 'boss', shop: 'shop', redeem: 'redeemed' };

export function logRewardChanges(before: RewardSnapshot, after: RewardSnapshot, now: Date): void {
  const parts: string[] = [];
  const rows: Record<string, Record<string, number>> = {};

  // Habit rewards, per habit.
  const habit = diffRewardTotals(before.habits.total, after.habits.total);
  if (habit) {
    parts.push(
      ...Object.entries(habit.xp).map(([stat, n]) => `${signed(n!)} ${stat} XP`),
      ...(habit.gold ? [`${signed(habit.gold)} Gold (habits)`] : []),
      ...(habit.tokens ? [`${signed(habit.tokens)} Tokens (habits)`] : []),
    );
    for (const name of new Set([...before.habits.byHabit.keys(), ...after.habits.byHabit.keys()])) {
      const d = diffRewardTotals(before.habits.byHabit.get(name) ?? EMPTY, after.habits.byHabit.get(name) ?? EMPTY);
      if (d) rows[`habit: ${name}`] = { ...Object.fromEntries(Object.entries(d.xp).map(([s, n]) => [`${s} XP`, n!])), Gold: d.gold, Tokens: d.tokens };
    }
  }

  // Encounters, bosses, shop and redemptions.
  for (const source of Object.keys(LABEL) as (keyof SourceTotals)[]) {
    const gold = after.sources[source].gold - before.sources[source].gold;
    const tokens = after.sources[source].tokens - before.sources[source].tokens;
    if (gold) parts.push(`${signed(gold)} Gold (${LABEL[source]})`);
    if (tokens) parts.push(`${signed(tokens)} Tokens (${LABEL[source]})`);
    if (gold || tokens) rows[LABEL[source]] = { Gold: gold, Tokens: tokens };
  }

  if (!parts.length) return;
  const { gold, tokens } = after.balance;
  console.groupCollapsed(
    `%c[rewards]%c ${parts.join(', ')}  → balance ${gold} Gold, ${tokens} Tokens (game time ${now.toLocaleString()})`,
    'color:#f2b544;font-weight:bold',
    '',
  );
  console.table(rows);
  console.log('Habit totals:', after.habits.total, '| by source:', after.sources);
  console.groupEnd();
}
