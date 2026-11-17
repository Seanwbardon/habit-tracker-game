// Bar chart of recent periods, with the target as a dashed line. No chart library needed.
import type { Habit, PeriodResult } from '../../domain/types.ts';

export function HabitChart({ habit, results }: { habit: Habit; results: PeriodResult[] }) {
  if (results.length === 0) return <p className="muted small">History appears once a period closes.</p>;
  const W = 280;
  const H = 70;
  const max = Math.max(habit.target * 1.3, ...results.map((r) => r.total), 1);
  const bw = W / results.length;
  const y = (v: number) => H - (v / max) * H;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H + 14}`} role="img" aria-label={`${habit.name} history`}>
      {results.map((r, i) => (
        <g key={r.periodKey}>
          <rect
            x={i * bw + 3}
            y={y(r.total)}
            width={bw - 6}
            height={Math.max(1, H - y(r.total))}
            className={r.achieved ? 'bar ok' : 'bar miss'}
          >
            <title>{`${r.start.slice(0, 10)}: ${r.total} ${habit.unit}`}</title>
          </rect>
          <text x={i * bw + bw / 2} y={H + 12} textAnchor="middle" className="axis">
            {r.start.slice(5, 10)}
          </text>
        </g>
      ))}
      <line x1={0} x2={W} y1={y(habit.target)} y2={y(habit.target)} className="target" />
    </svg>
  );
}
