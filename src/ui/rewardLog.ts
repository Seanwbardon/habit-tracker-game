// Dev-only console output: how much habit rewards (XP per stat, Gold, Tokens) changed
// after a log, backfill, edit, delete, period closing or dev-clock jump.
import { diffRewardTotals, type RewardTotals } from '../domain/game.ts';

type Totals = { total: RewardTotals; byHabit: Map<string, RewardTotals> };
const EMPTY: RewardTotals = { xp: {}, gold: 0, tokens: 0 };
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;

function describe(d: RewardTotals): string {
  return [
    ...Object.entries(d.xp).map(([stat, n]) => `${signed(n!)} ${stat} XP`),
    ...(d.gold ? [`${signed(d.gold)} Gold`] : []),
    ...(d.tokens ? [`${signed(d.tokens)} Tokens`] : []),
  ].join(', ');
}

export function logRewardChanges(before: Totals, after: Totals, now: Date): void {
  const total = diffRewardTotals(before.total, after.total);
  if (!total) return;

  const rows: Record<string, Record<string, number>> = {};
  for (const name of new Set([...before.byHabit.keys(), ...after.byHabit.keys()])) {
    const d = diffRewardTotals(before.byHabit.get(name) ?? EMPTY, after.byHabit.get(name) ?? EMPTY);
    if (!d) continue;
    rows[name] = {
      ...Object.fromEntries(Object.entries(d.xp).map(([stat, n]) => [`${stat} XP`, n!])),
      Gold: d.gold,
      Tokens: d.tokens,
    };
  }
  const totalXp = Object.values(total.xp).reduce((s, n) => s + (n ?? 0), 0);

  console.groupCollapsed(
    `%c[rewards]%c ${describe(total)}  (${signed(totalXp)} XP total, game time ${now.toLocaleString()})`,
    'color:#f2b544;font-weight:bold',
    '',
  );
  console.table(rows);
  console.log('New habit totals:', { xp: after.total.xp, gold: after.total.gold, tokens: after.total.tokens });
  console.groupEnd();
}
