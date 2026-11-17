// ─────────────────────────────────────────────────────────────
// CLASSES — edit freely. Classes are chosen freely by the player;
// the app only uses primaryStats to show guidance.
// ─────────────────────────────────────────────────────────────
import type { StatId } from './stats.ts';

export interface ClassDef {
  id: string;
  name: string;
  description: string;
  primaryStats: [StatId, StatId];
  /** Starting stat values before any habit XP. */
  baseStats: Record<StatId, number>;
  suggestedHabits: string[];
}

const base = (overrides: Partial<Record<StatId, number>>): Record<StatId, number> => ({
  STR: 5, DEX: 5, INT: 5, CON: 5, WIS: 5, CHA: 5,
  ...overrides,
});

export const CLASSES: ClassDef[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    description: 'A front-line fighter who hits hard and takes hits.',
    primaryStats: ['STR', 'CON'],
    baseStats: base({ STR: 8, CON: 8 }),
    suggestedHabits: ['Gym', 'Running', 'Sleep schedule'],
  },
  {
    id: 'rogue',
    name: 'Rogue',
    description: 'Fast and precise, strikes first and crits often.',
    primaryStats: ['DEX', 'CHA'],
    baseStats: base({ DEX: 9, CHA: 7 }),
    suggestedHabits: ['Instrument practice', 'Drawing', 'Typing practice'],
  },
  {
    id: 'mage',
    name: 'Mage',
    description: 'Fragile but devastating magic damage.',
    primaryStats: ['INT', 'WIS'],
    baseStats: base({ INT: 9, WIS: 7, CON: 4 }),
    suggestedHabits: ['Studying', 'Reading', 'Language learning'],
  },
  {
    id: 'cleric',
    name: 'Cleric',
    description: 'Durable support who heals and shields.',
    primaryStats: ['WIS', 'CON'],
    baseStats: base({ WIS: 9, CON: 7 }),
    suggestedHabits: ['Meditation', 'Cutting back smoking', 'Journaling'],
  },
  {
    id: 'bard',
    name: 'Bard',
    description: 'Buffs allies and finds better loot.',
    primaryStats: ['CHA', 'DEX'],
    baseStats: base({ CHA: 9, DEX: 7 }),
    suggestedHabits: ['Socialising', 'Calling family', 'Creative writing'],
  },
];

export function getClass(id: string): ClassDef {
  const c = CLASSES.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown class: ${id}`);
  return c;
}

/** Classes that list this stat as primary. Used by the habit-creation helper. */
export function classesUsingStat(stat: StatId): ClassDef[] {
  return CLASSES.filter((c) => c.primaryStats.includes(stat));
}
