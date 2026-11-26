// Multi-series line chart, one y-axis. Identity is carried by colour AND dash
// pattern + legend; emphasised series are thicker and direct-labelled.
import { fmt, labelWidth, niceScale, thinLabels, useWidth } from './axis.ts';

export interface Series {
  id: string;
  label: string;
  values: number[];
  /** CSS class that sets the stroke colour, e.g. "s1". */
  colorClass: string;
  dash?: string;
  emphasis?: boolean;
}

export interface Marker {
  index: number;
  value: number;
  title: string;
}

interface Props {
  xLabels: string[];
  /** Exact x description for hover text (defaults to the axis label). */
  xTitles?: string[];
  series: Series[];
  height?: number;
  formatY?: (v: number) => string;
  unit?: string;
  /** Downward triangles, e.g. spending days on a balance line. */
  markers?: Marker[];
  ariaLabel: string;
  empty?: string;
}

const LEFT = 34;
const BOTTOM = 18;
const TOP = 8;

export function LineChart({ xLabels, xTitles = xLabels, series, height = 160, formatY = fmt, unit = '', markers = [], ariaLabel, empty = 'No data yet.' }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const hasData = xLabels.length > 0 && series.some((s) => s.values.some((v) => v !== 0));
  if (!hasData) return <div ref={ref} className="chart-wrap"><p className="muted small chart-empty">{empty}</p></div>;

  const labelled = series.filter((s) => s.emphasis);
  const RIGHT = labelled.length ? 40 : 8;
  const plotW = width - LEFT - RIGHT;
  const plotH = height - TOP - BOTTOM;
  const n = xLabels.length;
  const { max, ticks } = niceScale(Math.max(...series.flatMap((s) => s.values), 0));
  const x = (i: number) => LEFT + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => TOP + plotH - (v / max) * plotH;
  const show = thinLabels(xLabels, plotW);
  // Centre labels on their point, clamped inside the plot; drop a neighbour of the first/last if they'd touch.
  const lx = (i: number) => {
    const half = labelWidth(xLabels[i]) / 2;
    return Math.min(Math.max(x(i), LEFT + half), LEFT + plotW - half);
  };
  const shown = [...show].sort((a, b) => a - b);
  const touching = (a: number, b: number) => lx(b) - lx(a) < (labelWidth(xLabels[a]) + labelWidth(xLabels[b])) / 2;
  if (shown.length > 2 && touching(shown[0], shown[1])) show.delete(shown[1]);
  if (shown.length > 1 && touching(shown[shown.length - 2], shown[shown.length - 1])) show.delete(shown[shown.length - 2]);
  const dots = n <= 40;

  // Direct labels at the right edge, nudged apart so they never overlap.
  const ends = labelled
    .map((s) => ({ s, y: y(s.values[n - 1] ?? 0) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 14);

  return (
    <div ref={ref} className="chart-wrap">
      <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={LEFT} x2={LEFT + plotW} y1={y(t)} y2={y(t)} className="grid" />
            <text x={LEFT - 4} y={y(t) + 3} textAnchor="end" className="axis">{formatY(t)}</text>
          </g>
        ))}
        {xLabels.map((l, i) =>
          show.has(i) ? (
            <text key={i} x={lx(i)} y={height - 4} textAnchor="middle" className="axis">{l}</text>
          ) : null,
        )}

        {/* Non-emphasised first so the emphasised lines sit on top. */}
        {[...series].sort((a, b) => Number(!!a.emphasis) - Number(!!b.emphasis)).map((s) => (
          <g key={s.id} className={`series ${s.colorClass} ${s.emphasis ? 'em' : 'dim'}`}>
            <path
              d={s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')}
              className="line"
              strokeDasharray={s.dash}
            />
            {s.values.map((v, i) => (
              <g key={i}>
                <title>{`${s.label} · ${xTitles[i]}: ${fmt(v)}${unit}`}</title>
                <circle cx={x(i)} cy={y(v)} r={8} className="hit" />
                {dots && <circle cx={x(i)} cy={y(v)} r={s.emphasis ? 3 : 2.2} className="dot" />}
              </g>
            ))}
          </g>
        ))}

        {markers.map((m) => {
          const cx = x(m.index);
          const cy = Math.min(y(m.value) + 6, TOP + plotH - 1);
          return (
            <g key={m.index} className="drop">
              <title>{m.title}</title>
              <path d={`M${cx - 4},${cy} L${cx + 4},${cy} L${cx},${cy + 6} Z`} />
            </g>
          );
        })}

        {ends.map(({ s, y: ly }) => (
          <text key={s.id} x={LEFT + plotW + 5} y={ly + 3} className="end-label">{s.label}</text>
        ))}
        <line x1={LEFT} x2={LEFT + plotW} y1={TOP + plotH} y2={TOP + plotH} className="baseline" />
      </svg>
      {series.length > 1 && (
        <div className="legend">
          {series.map((s) => (
            <span key={s.id} className={s.emphasis ? 'em' : ''}>
              <svg width="22" height="8" aria-hidden="true" className={`series ${s.colorClass} ${s.emphasis ? 'em' : 'dim'}`}>
                <line x1="1" x2="21" y1="4" y2="4" className="line" strokeDasharray={s.dash} />
              </svg>
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
