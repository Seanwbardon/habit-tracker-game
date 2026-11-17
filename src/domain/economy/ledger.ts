// Economy: habit income is derived from logs; everything else
// (encounter drops, purchases, redemptions) is an append-only stored ledger.
import { REWARDS } from '../../config/rewards.ts';
import { allHabitRewards } from '../rules/rewards.ts';
import { addDays } from '../time.ts';
import type { Currency, Habit, HabitLog, LedgerEntry } from '../types.ts';

/** Derived ledger entries for habit income (never stored). */
export function habitLedger(habits: Habit[], logs: HabitLog[], now: Date): LedgerEntry[] {
  return allHabitRewards(habits, logs, now).flatMap(({ habit, reward }) => {
    const base = { source: 'habit' as const, ref: `${habit.id}:${reward.result.periodKey}`, at: reward.result.end };
    const out: LedgerEntry[] = [];
    if (reward.gold) out.push({ ...base, id: `${base.ref}:gold`, currency: 'gold', amount: reward.gold });
    if (reward.tokens) out.push({ ...base, id: `${base.ref}:tokens`, currency: 'tokens', amount: reward.tokens });
    return out;
  });
}

export function balance(entries: LedgerEntry[], currency: Currency): number {
  return entries.filter((e) => e.currency === currency).reduce((s, e) => s + e.amount, 0);
}

/**
 * How much Gold encounters may still award right now:
 * at most `encounterGoldCap` × the habit Gold earned in the last 7 days,
 * minus encounter Gold already earned in that window.
 */
export function encounterGoldAllowance(fullLedger: LedgerEntry[], now: Date): number {
  const since = addDays(now, -7).getTime();
  const recent = fullLedger.filter((e) => e.currency === 'gold' && new Date(e.at).getTime() >= since);
  const habitGold = recent.filter((e) => e.source === 'habit').reduce((s, e) => s + e.amount, 0);
  const encounterGold = recent.filter((e) => e.source === 'encounter').reduce((s, e) => s + e.amount, 0);
  return Math.max(0, Math.floor(habitGold * REWARDS.encounterGoldCap) - encounterGold);
}

export function canAfford(entries: LedgerEntry[], currency: Currency, cost: number): boolean {
  return balance(entries, currency) >= cost;
}
