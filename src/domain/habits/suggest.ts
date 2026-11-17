// Recommends primary/secondary stats while a habit is being created.
// Suggestions only — the player always makes the final choice.
import { CLASSES, getClass } from '../../config/classes.ts';
import { STATS, STAT_INFO, type StatId } from '../../config/stats.ts';

export interface StatSuggestion {
  stat: StatId;
  /** Why it was suggested, shown under the form field. */
  reason: string;
}

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3);

/** Loose match: "study" ~ "studying", "run" ~ "running". */
function similar(a: string, b: string): boolean {
  const n = Math.min(a.length, b.length, 5);
  return n >= 3 && a.slice(0, n) === b.slice(0, n);
}

function matches(name: string, examples: string[]): string | undefined {
  const nameWords = words(name);
  return examples.find((ex) => words(ex).some((w) => nameWords.some((n) => similar(n, w))));
}

/**
 * Up to two suggested stats for a habit name, best first.
 * Falls back to the current character's class stats when the name gives no clue.
 */
export function suggestStats(habitName: string, currentClassId?: string): StatSuggestion[] {
  const out: StatSuggestion[] = [];
  const add = (stat: StatId, reason: string) => {
    if (out.length < 2 && !out.some((s) => s.stat === stat)) out.push({ stat, reason });
  };

  for (const stat of STATS) {
    const hit = matches(habitName, STAT_INFO[stat].habitExamples);
    if (hit) add(stat, `${STAT_INFO[stat].name} habits include “${hit}”`);
  }
  for (const cls of CLASSES) {
    const hit = matches(habitName, cls.suggestedHabits);
    if (hit) for (const stat of cls.primaryStats) add(stat, `${cls.name}s train this with “${hit}”`);
  }
  if (currentClassId) {
    const cls = getClass(currentClassId);
    for (const stat of cls.primaryStats) add(stat, `A primary stat of your ${cls.name}`);
  }
  return out;
}
