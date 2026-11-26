// Calendar heatmap: one cell per day, weeks as columns (Mon at the top).
// Intensity = amount logged (single-hue ramp). Missed days of a daily habit
// also get an outline, so "missed" never relies on colour.
import type { HeatCell } from '../../../domain/habits/history.ts';
import { fmt, monthName, useWidth } from './axis.ts';

const LEFT = 24;
const TOP = 13;

export function Heatmap({ cells, weeks, unit, year }: { cells: HeatCell[]; weeks: number; unit: string; year: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const cell = Math.max(4, Math.min(14, Math.floor((width - LEFT) / weeks)));
  const gap = cell >= 9 ? 2 : 1;
  const w = LEFT + weeks * cell;
  const h = TOP + 7 * cell;
  const anyLogged = cells.some((c) => c.total > 0);
  const anyMissed = cells.some((c) => c.missed);

  // Month labels at the column of each 1st, skipped if they'd collide.
  const months: { col: number; m: number }[] = [];
  let lastX = -Infinity;
  for (const c of cells) {
    if (!c.date.endsWith('-01')) continue;
    const px = LEFT + c.col * cell;
    if (px - lastX < 24) continue;
    months.push({ col: c.col, m: Number(c.date.slice(5, 7)) - 1 });
    lastX = px;
  }

  return (
    <div ref={ref} className="chart-wrap">
      <svg className="chart heatmap" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Daily totals in ${year}`}>
        {months.map(({ col, m }) => (
          <text key={m} x={LEFT + col * cell} y={9} className="axis">{monthName(m)}</text>
        ))}
        {(cell >= 7 ? [['Mon', 0], ['Wed', 2], ['Fri', 4]] : [['Mon', 0], ['Fri', 4]]).map(([d, row]) => (
          <text key={d} x={LEFT - 4} y={TOP + Number(row) * cell + (cell - gap) / 2 + 3} textAnchor="end" className="axis">{d}</text>
        ))}
        {cells.map((c) => (
          <rect
            key={c.date}
            x={LEFT + c.col * cell}
            y={TOP + c.row * cell}
            width={cell - gap}
            height={cell - gap}
            rx={cell >= 9 ? 2 : 1}
            className={`heat l${c.level}${c.future ? ' future' : ''}${c.missed ? ' missed' : ''}`}
          >
            <title>{c.future ? c.date : `${c.date}: ${fmt(c.total)} ${unit}${c.missed ? ' (missed)' : ''}`}</title>
          </rect>
        ))}
      </svg>
      <div className="legend">
        {!anyLogged && <span className="muted">Nothing logged in {year} yet.</span>}
        <span>
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <svg key={l} width="10" height="10" aria-hidden="true"><rect width="9" height="9" rx="1.5" className={`heat l${l}`} /></svg>
          ))}
          More
        </span>
        {anyMissed && (
          <span>
            <svg width="10" height="10" aria-hidden="true"><rect x="0.5" y="0.5" width="8" height="8" rx="1.5" className="heat l0 missed" /></svg>
            outlined = missed
          </span>
        )}
      </div>
    </div>
  );
}
