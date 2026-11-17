// Calendar-aligned seasons: Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec.
import { BOSS_WINDOW_DAYS } from '../../config/seasons.ts';
import { addDays } from '../time.ts';
import type { PeriodResult, SeasonInfo } from '../types.ts';

export function seasonFor(d: Date): SeasonInfo {
  const year = d.getFullYear();
  const index = (Math.floor(d.getMonth() / 3) + 1) as SeasonInfo['index'];
  return makeSeason(year, index);
}

export function makeSeason(year: number, index: SeasonInfo['index']): SeasonInfo {
  const startMonth = (index - 1) * 3;
  return {
    id: `${year}-S${index}`,
    year,
    index,
    start: new Date(year, startMonth, 1),
    end: new Date(year, startMonth + 3, 1),
  };
}

export function seasonsOfYear(year: number): SeasonInfo[] {
  return ([1, 2, 3, 4] as const).map((i) => makeSeason(year, i));
}

export function bossWindowStart(season: SeasonInfo): Date {
  return addDays(season.end, -BOSS_WINDOW_DAYS);
}

export function isInBossWindow(d: Date): boolean {
  const s = seasonFor(d);
  return d >= bossWindowStart(s) && d < s.end;
}

/** The Final Boss is available during the boss window of season 4. */
export function isFinalBossAvailable(d: Date): boolean {
  return seasonFor(d).index === 4 && isInBossWindow(d);
}

export function daysLeftInSeason(d: Date): number {
  const s = seasonFor(d);
  return Math.ceil((s.end.getTime() - d.getTime()) / 86_400_000);
}

/** A period belongs to the season its last moment falls in. */
export function seasonIdOfResult(result: PeriodResult): string {
  return seasonFor(new Date(new Date(result.end).getTime() - 1)).id;
}
