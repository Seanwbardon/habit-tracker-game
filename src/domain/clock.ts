// The single source of "now" for the whole app.
// The dev offset lets you fast-forward to test season ends and bosses
// before they happen for real. Never call `new Date()` for game logic elsewhere.

let devOffsetMs = 0;

export function now(): Date {
  return new Date(Date.now() + devOffsetMs);
}

export function setDevOffsetDays(days: number): void {
  devOffsetMs = days * 24 * 60 * 60 * 1000;
}

/** Jump the clock to a specific date (keeps time of day running). */
export function setDevNow(target: Date): void {
  devOffsetMs = target.getTime() - Date.now();
}

export function getDevOffsetDays(): number {
  return Math.round(devOffsetMs / (24 * 60 * 60 * 1000));
}

export function resetClock(): void {
  devOffsetMs = 0;
}
