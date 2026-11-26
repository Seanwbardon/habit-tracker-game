// Period history for one habit (following its edit chain), with range toggle and streaks.
import { useState } from 'react';
import { chainResults, periodHistory, streaks, type HistoryBar, type HistoryRange } from '../../domain/habits/history.ts';
import type { Habit, HabitLog, Period } from '../../domain/types.ts';
import { fmt, monthName, shortDate } from './charts/axis.ts';
import { BarChart, BarLegend, type Bar } from './charts/BarChart.tsx';

const RANGES: { id: HistoryRange; label: string }[] = [
  { id: 'recent', label: '8 periods' },
  { id: 'season', label: 'Season' },
  { id: 'year', label: 'Year' },
];
const UNIT: Record<Period, [string, string]> = { daily: ['day', 'days'], weekly: ['week', 'weeks'], monthly: ['month', 'months'] };

export function periodLabel(start: Date, period: Period): string {
  return period === 'monthly' ? monthName(start.getMonth()) : shortDate(start);
}

export function toBars(history: HistoryBar[], unit: string): Bar[] {
  const periodOf = (b: HistoryBar) => b.periodKey.split('/')[1] as Period;
  return history.map((b) => {
    const start = new Date(b.start);
    const label = periodLabel(start, periodOf(b));
    const limit = b.kind === 'limit';
    const status = b.open ? 'open, not scored yet' : b.achieved ? (limit ? 'under the limit' : 'met') : limit ? 'over the limit' : 'missed';
    return {
      key: b.periodKey,
      value: b.total,
      label,
      target: b.target,
      state: b.open ? 'open' : b.achieved ? 'good' : 'bad',
      title: `${label}${periodOf(b) === 'weekly' ? ' week' : ''}: ${fmt(b.total)} / ${limit ? '≤ ' : ''}${fmt(b.target)} ${unit} (${status})`,
    };
  });
}

interface Props {
  chain: Habit[];
  logs: HabitLog[];
  now: Date;
  height?: number;
  defaultRange?: HistoryRange;
}

export function HabitChart({ chain, logs, now, height = 90, defaultRange = 'recent' }: Props) {
  const [range, setRange] = useState<HistoryRange>(defaultRange);
  const head = chain[chain.length - 1];
  const history = periodHistory(chain, logs, now, range);
  const s = streaks(chainResults(chain, logs, now));
  const [one, many] = UNIT[head.period];
  const limit = head.kind === 'limit';
  const noneClosed = history.length <= 1;

  return (
    <div className="habit-chart">
      <div className="row between">
        <span className="small streak" title="Consecutive periods with the target met">
          🔥 Streak <strong>{s.current}</strong> {s.current === 1 ? one : many} · Best <strong>{s.best}</strong>
        </span>
        <div className="seg" role="group" aria-label="Chart range">
          {RANGES.map((r) => (
            <button key={r.id} className={`small ${range === r.id ? 'active' : ''}`} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <BarChart
        bars={toBars(history, head.unit)}
        height={height}
        zones={limit ? 'limit' : undefined}
        ariaLabel={`${head.name} history`}
      />
      <BarLegend
        items={[
          { kind: 'good', label: limit ? 'under limit' : 'met' },
          { kind: 'bad', label: limit ? 'over limit' : 'missed' },
          { kind: 'open', label: 'open (not scored)' },
          { kind: 'target', label: limit ? 'limit' : 'target' },
        ]}
      />
      {noneClosed && <p className="muted small">History builds up as periods close.</p>}
    </div>
  );
}
