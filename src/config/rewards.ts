// ─────────────────────────────────────────────────────────────
// REWARD TUNING — all balance numbers live here.
// Habit rewards are recomputed from logs, so changing these
// rebalances past periods too (except for what's already been spent).
// ─────────────────────────────────────────────────────────────
import type { Period } from '../domain/types.ts';

export const REWARDS = {
  /** Base XP for fully completing one period at difficulty 1. */
  baseXp: { daily: 10, weekly: 60, monthly: 250 } satisfies Record<Period, number>,

  /** Multiplier per difficulty (index 1–5). */
  difficultyMultiplier: [0, 1, 1.5, 2, 2.75, 3.5],

  /** Share of a habit's XP going to its primary stat (rest to secondary). */
  primaryShare: 0.7,

  /** Extra XP when a target is fully met (0.2 = +20%). */
  completionBonus: 0.2,

  /**
   * DAILY habits: one-off bonus XP (at difficulty 1, scaled by difficulty) for
   * meeting the target on all 7 days of a Monday–Sunday week. Each day is still
   * rewarded on its own; this lands on top when the week closes.
   * 50 ≈ four extra days' worth: a perfect week pays ~1.6× seven days alone.
   */
  perfectWeekBonusXp: 50,

  /**
   * WEEKLY / MONTHLY habits: their base XP is paid out day by day as you make
   * progress; when the period closes with the target met, this share of base XP
   * is added as a completion bonus (1 = doubles a full week's reward).
   */
  periodCompletionBonus: 1,

  /** Max score for going over a BUILD target / well under a LIMIT. */
  scoreCap: 1.25,

  /** LIMIT habits: bonus per unit of headroom under the limit (as share of target). */
  limitHeadroomBonus: 0.25,

  /** BUILD habits: below this ratio the period earns nothing. */
  buildMinRatio: 0.25,

  /** Gold earned per XP point. */
  goldPerXp: 0.5,

  /** Real-life Tokens per XP point. Only granted when the target is met. */
  tokensPerXp: 0.1,

  /** Encounters may award at most this share of the last 7 days' habit Gold. */
  encounterGoldCap: 0.2,

  /** XP needed for +1 to a stat. */
  xpPerStatPoint: 40,

  /** Total XP needed per character level. */
  xpPerLevel: 150,
};
