// Facade: combines stored data + clock into everything the UI needs.
// The UI should call these rather than reaching into individual modules.
import type { Encounter } from './encounters/generator.ts';
import { freezeCharacter, viewCharacter, type CharacterView } from './character/stats.ts';
import { balance, encounterGoldAllowance, habitLedger } from './economy/ledger.ts';
import { closedResults } from './habits/evaluate.ts';
import { seasonFor } from './seasons/calendar.ts';
import { addDays } from './time.ts';
import type { Character, CharacterSnapshot, Habit, HabitLog, LedgerEntry, RealReward } from './types.ts';

export interface SavedEncounter {
  id: string;
  title: string;
  savedAt: string;
  /** The full generated encounter, so it replays exactly even after generator changes. */
  encounter: Encounter;
  /** The party as it was when fought. */
  party: CharacterSnapshot[];
}

export interface AppData {
  schemaVersion: 2;
  userId: string;
  habits: Habit[];
  logs: HabitLog[];
  characters: Character[];
  /** Non-habit entries only (encounters, bosses, shop, redemptions). */
  ledger: LedgerEntry[];
  realRewards: RealReward[];
  inventory: string[];
  /** Date keys / boss ids already fought, so each can be done once. */
  completedEncounters: string[];
  savedEncounters: SavedEncounter[];
  devOffsetDays: number;
}

export function emptyData(): AppData {
  return {
    schemaVersion: 2,
    userId: crypto.randomUUID(),
    habits: [],
    logs: [],
    characters: [],
    ledger: [],
    realRewards: [
      { id: 'takeaway', name: 'Takeaway night', cost: 50 },
      { id: 'game', name: 'New video game', cost: 200 },
    ],
    inventory: [],
    completedEncounters: [],
    savedEncounters: [],
    devOffsetDays: 0,
  };
}

export function fullLedger(d: AppData, now: Date): LedgerEntry[] {
  return [...habitLedger(d.habits, d.logs, now), ...d.ledger];
}

export function wallet(d: AppData, now: Date) {
  const l = fullLedger(d, now);
  return {
    gold: balance(l, 'gold'),
    tokens: balance(l, 'tokens'),
    encounterGoldLeft: encounterGoldAllowance(l, now),
  };
}

export function currentCharacter(d: AppData, now: Date): Character | undefined {
  const sid = seasonFor(now).id;
  return d.characters.find((c) => c.seasonId === sid);
}

export function currentCharacterView(d: AppData, now: Date): CharacterView | undefined {
  const c = currentCharacter(d, now);
  return c ? viewCharacter(c, d.habits, d.logs, now) : undefined;
}

/** Average score of periods that closed in the last 7 days (0 if none). */
export function recentScore(d: AppData, now: Date): number {
  const since = addDays(now, -7).getTime();
  const results = d.habits
    .flatMap((h) => closedResults(h, d.logs, now))
    .filter((r) => new Date(r.end).getTime() >= since);
  if (!results.length) return 0;
  return results.reduce((s, r) => s + r.score, 0) / results.length;
}

/** Characters from a given year with frozen snapshots — the Final Boss party pool. */
export function archivedPartyForYear(d: AppData, year: number) {
  return d.characters.filter((c) => c.seasonId.startsWith(`${year}-`) && c.snapshot).map((c) => c.snapshot!);
}

/**
 * Everyone who can join this year's Final Boss: archived S1–S3 characters,
 * plus the current Season 4 character (frozen as they are right now).
 */
export function finalBossParty(d: AppData, now: Date): CharacterSnapshot[] {
  const year = now.getFullYear();
  const party = archivedPartyForYear(d, year);
  const view = currentCharacterView(d, now);
  if (view && view.character.seasonId === `${year}-S4`) party.push(freezeCharacter(view, now));
  return party;
}

/**
 * Freezes characters whose season has ended. Call on app start and on every clock change.
 * Returns updated data (or the same object if nothing changed).
 */
export function archiveEndedSeasons(d: AppData, now: Date): AppData {
  const currentId = seasonFor(now).id;
  let changed = false;
  const characters = d.characters.map((c) => {
    const [y, s] = c.seasonId.split('-S').map(Number);
    const seasonEnd = new Date(y, s * 3, 1);
    const ended = now >= seasonEnd;
    // The dev clock was moved back into this season: thaw it (snapshots are derived, so nothing is lost).
    if (c.snapshot && !ended) {
      changed = true;
      const { snapshot: _thawed, ...live } = c;
      return { ...live, equipment: c.snapshot.equipment };
    }
    if (c.snapshot || !ended || c.seasonId === currentId) return c;
    // Freeze at the moment the season ended, so later logs don't count.
    const view = viewCharacter(c, d.habits, d.logs, seasonEnd);
    changed = true;
    return { ...c, snapshot: freezeCharacter(view, seasonEnd) };
  });
  return changed ? { ...d, characters } : d;
}
