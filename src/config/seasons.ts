// Season and boss tuning.

/** Days at the end of each season when the season boss can be fought. */
export const BOSS_WINDOW_DAYS = 7;

/** Final Boss strength by party size (1–4 characters). */
export const FINAL_BOSS_PARTY_FACTOR: Record<number, number> = {
  1: 0.22,
  2: 0.48,
  3: 0.74,
  4: 1.0,
};

/** Final Boss rewards by party size — fewer characters, smaller rewards. */
export const FINAL_BOSS_REWARD_FACTOR: Record<number, number> = {
  1: 0.4,
  2: 0.6,
  3: 0.8,
  4: 1.0,
};

export const FINAL_BOSS_BASE = {
  name: 'The Year Eater',
  hp: 1400,
  atk: 40,
  def: 14,
  spd: 12,
  gold: 1000,
};

export const SEASON_BOSS_BASE = {
  hp: 300,
  atk: 14,
  def: 8,
  spd: 9,
  gold: 250,
};

/** Season boss names, by season index (1–4). */
export const SEASON_BOSS_NAMES = ['', 'Frost Warden', 'Bloom Hydra', 'Sun Colossus', 'Harvest Wraith'];
