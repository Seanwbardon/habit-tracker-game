// Bar chart with an optional (per-bar) target line and limit zones. Hand-written SVG.
// Bar state is shown by fill pattern + outline as well as colour:
//   good = solid, bad = hatched with outline, open = striped with dashed outline.
import { useId } from 'react';
import { fmt, niceScale, thinLabels, useWidth } from './axis.ts';

const MAX_BAR = 32;
import { Patterns } from './Patterns.tsx';

export type BarState = 'good' | 'bad' | 'open' | 'neutral' | 'none';

export interface Bar {
  key: string;
  value: number;
  /** Axis label (may be thinned out when crowded). */
  label: string;
  /** Hover text with the exact value. */
  title: string;
  state: BarState;
  target?: number;
}

interface Props {
  bars: Bar[];
  height?: number;
  /** 'limit' shades the area above the target as bad and below as good. */
  zones?: 'limit';
  max?: number;
  formatY?: (v: number) => string;
  ariaLabel: string;
  empty?: string;
}

const LEFT = 30;
const BOTTOM = 18;
const TOP = 6;

export function BarChart({ bars, height = 90, zones, max: fixedMax, formatY = fmt, ariaLabel, empty = 'No data yet.' }: Props) {
  const pid = useId().replace(/:/g, '');
  const [ref, width] = useWidth<HTMLDivElement>();
  if (bars.length === 0) return <div ref={ref} className="chart-wrap"><p className="muted small chart-empty">{empty}</p></div>;

  const plotW = width - LEFT;
  const plotH = height - TOP - BOTTOM;
  const dataMax = Math.max(...bars.map((b) => Math.max(b.value, (b.target ?? 0) * 1.25)), 0);
  const { max, ticks } = fixedMax ? { max: fixedMax, ticks: [0, fixedMax / 2, fixedMax] } : niceScale(dataMax);
  const y = (v: number) => TOP + plotH - (Math.min(v, max) / max) * plotH;
  const bw = plotW / bars.length;
  const gap = bw >= 8 ? 2 : bw >= 4 ? 1 : 0;
  const show = thinLabels(bars.map((b) => b.label), plotW);
  const x0 = (i: number) => LEFT + i * bw;

  // Target as a stepped dashed line (versions of a habit can have different targets).
  let targetPath = '';
  bars.forEach((b, i) => {
    if (b.target === undefined) return;
    const prev = bars[i - 1]?.target;
    targetPath += `${prev === b.target ? 'L' : 'M'}${x0(i)},${y(b.target)} L${x0(i + 1)},${y(b.target)} `;
  });

  return (
    <div ref={ref} className="chart-wrap">
      <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        <Patterns id={pid} />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={LEFT} x2={width} y1={y(t)} y2={y(t)} className="grid" />
            <text x={LEFT - 4} y={y(t) + 3} textAnchor="end" className="axis">{formatY(t)}</text>
          </g>
        ))}

        {zones === 'limit' &&
          bars.map((b, i) =>
            b.target === undefined ? null : (
              <g key={`z${b.key}`}>
                <rect x={x0(i)} width={bw} y={TOP} height={Math.max(0, y(b.target) - TOP)} fill={`url(#${pid}-zone)`} className="zone-bad" />
                <rect x={x0(i)} width={bw} y={y(b.target)} height={Math.max(0, TOP + plotH - y(b.target))} className="zone-good" />
              </g>
            ),
          )}
        {zones === 'limit' && bars[0]?.target !== undefined && (
          <text x={LEFT + 3} y={TOP + 9} className="zone-label">✗ over limit</text>
        )}

        {bars.map((b, i) => {
          // A missed period with nothing logged still gets a small hatched stub, so it isn't read as "no data".
          const h = Math.max(b.value > 0 ? 1.5 : b.state === 'bad' ? 4 : 0, TOP + plotH - y(b.value));
          const w = Math.min(MAX_BAR, Math.max(1, bw - gap));
          const bx = x0(i) + (bw - w) / 2;
          const by = TOP + plotH - h;
          const r = Math.min(3, w / 2, h);
          const d = `M${bx},${by + h} V${by + r} Q${bx},${by} ${bx + r},${by} H${bx + w - r} Q${bx + w},${by} ${bx + w},${by + r} V${by + h} Z`;
          const fill = b.state === 'bad' ? `url(#${pid}-bad)` : b.state === 'open' ? `url(#${pid}-open)` : undefined;
          return (
            <g key={b.key} className="bar-g">
              <title>{b.title}</title>
              <rect x={x0(i)} y={TOP} width={bw} height={plotH} className="hit" />
              {h > 0 && <path d={d} className={`bar ${b.state}`} fill={fill} />}
              {b.state === 'open' && h === 0 && (
                <line x1={bx} x2={bx + w} y1={TOP + plotH - 0.5} y2={TOP + plotH - 0.5} className="bar open" />
              )}
              {show.has(i) && (
                <text x={x0(i) + bw / 2} y={height - 4} textAnchor="middle" className="axis">{b.label}</text>
              )}
            </g>
          );
        })}
        <line x1={LEFT} x2={width} y1={TOP + plotH} y2={TOP + plotH} className="baseline" />
        {targetPath && <path d={targetPath} className="target" />}
      </svg>
    </div>
  );
}

/** HTML legend with swatches matching the bar states. */
export function BarLegend({ items }: { items: { kind: BarState | 'target'; label: string }[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}>
          <i className={`sw ${it.kind}`} aria-hidden="true" />
          {it.label}
        </span>
      ))}
    </div>
  );
}
