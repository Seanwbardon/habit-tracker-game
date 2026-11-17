// Period maths, in the user's local time zone. Weeks start on Monday.
import type { Period } from './types.ts';

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export function periodStart(d: Date, period: Period): Date {
  const day = startOfDay(d);
  switch (period) {
    case 'daily':
      return day;
    case 'weekly': {
      const mondayOffset = (day.getDay() + 6) % 7; // Mon=0 … Sun=6
      return addDays(day, -mondayOffset);
    }
    case 'monthly':
      return new Date(d.getFullYear(), d.getMonth(), 1);
  }
}

/** Exclusive end of the period that starts at `start`. */
export function periodEnd(start: Date, period: Period): Date {
  switch (period) {
    case 'daily':
      return addDays(start, 1);
    case 'weekly':
      return addDays(start, 7);
    case 'monthly':
      return new Date(start.getFullYear(), start.getMonth() + 1, 1);
  }
}

export function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function periodKey(start: Date, period: Period): string {
  return `${toDateKey(start)}/${period}`;
}

/** All period starts from the one containing `from` up to (not including) the one containing `until`. */
export function closedPeriodStarts(from: Date, until: Date, period: Period): Date[] {
  const out: Date[] = [];
  const current = periodStart(until, period).getTime();
  let p = periodStart(from, period);
  while (p.getTime() < current) {
    out.push(p);
    p = periodEnd(p, period);
  }
  return out;
}
