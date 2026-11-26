// Local persistence. Swap this file for IndexedDB or a backend later —
// the rest of the app only uses load/save/export/import.
import { emptyData, type AppData } from '../domain/game.ts';

const KEY = 'habit-quest:data';

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    return migrate(JSON.parse(raw));
  } catch {
    return emptyData();
  }
}

export function saveData(d: AppData): void {
  localStorage.setItem(KEY, JSON.stringify(d));
}

/** Download a JSON backup. Do this regularly — localStorage can be cleared by the browser. */
export function exportData(d: AppData): void {
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `habit-quest-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importData(file: File): Promise<AppData> {
  return migrate(JSON.parse(await file.text()));
}

/** Upgrade older saves when AppData changes shape. Add one step per version. */
export function migrate(raw: any): AppData {
  let d = { ...raw };
  const version: number = d.schemaVersion ?? 1;

  if (version < 2) {
    // v2: Vitality (VIT) renamed to Constitution (CON).
    const rename = (s: string) => (s === 'VIT' ? 'CON' : s);
    const renameKeys = (stats?: Record<string, number>) => {
      if (!stats || !('VIT' in stats)) return stats;
      const { VIT, ...rest } = stats;
      return { ...rest, CON: VIT };
    };
    d.habits = (d.habits ?? []).map((h: any) => ({ ...h, primaryStat: rename(h.primaryStat), secondaryStat: rename(h.secondaryStat) }));
    const fixSnap = (s: any) => (s ? { ...s, stats: renameKeys(s.stats) } : s);
    d.characters = (d.characters ?? []).map((c: any) => ({ ...c, snapshot: fixSnap(c.snapshot) }));
    d.savedEncounters = (d.savedEncounters ?? []).map((e: any) => ({ ...e, party: (e.party ?? []).map(fixSnap) }));
  }

  if (version < 3) {
    // v3: habit edit chains (Habit.previousHabitId), test logs (HabitLog.test) and settings.
    // Both new fields are optional, so only the settings need a default.
    d.settings = { excludeTestLogs: true, ...(d.settings ?? {}) };
  }

  return { ...emptyData(), ...d, schemaVersion: 3 } as AppData;
}
