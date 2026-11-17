// ─────────────────────────────────────────────────────────────
// STATS — edit freely. Everything else reads from this list.
// Adding/removing a stat here updates classes, habit forms and combat.
// ─────────────────────────────────────────────────────────────

export const STATS = ['STR', 'DEX', 'INT', 'CON', 'WIS', 'CHA'] as const;
export type StatId = (typeof STATS)[number];

export interface StatInfo {
  name: string;
  description: string;
  /** Shown as suggestions when the user creates a habit. */
  habitExamples: string[];
}

export const STAT_INFO: Record<StatId, StatInfo> = {
  STR: {
    name: 'Strength',
    description: 'Physical power. Raises attack damage.',
    habitExamples: ['Gym sessions', 'Strength training', 'Running'],
  },
  DEX: {
    name: 'Dexterity',
    description: 'Skill and precision. Raises speed and critical hits.',
    habitExamples: ['Instrument practice', 'Drawing', 'Typing practice'],
  },
  INT: {
    name: 'Intelligence',
    description: 'Knowledge. Raises magic damage.',
    habitExamples: ['Studying', 'Reading', 'Language learning'],
  },
  CON: {
    name: 'Constitution',
    description: 'Health and endurance. Raises max HP.',
    habitExamples: ['Sleep schedule', 'Water intake', 'Cutting back smoking'],
  },
  WIS: {
    name: 'Wisdom',
    description: 'Self-control and focus. Raises defence and healing.',
    habitExamples: ['Meditation', 'Journaling', 'Limiting screen time'],
  },
  CHA: {
    name: 'Charisma',
    description: 'Connection with others. Raises buffs and loot luck.',
    habitExamples: ['Calling family', 'Socialising', 'Creative writing'],
  },
};
