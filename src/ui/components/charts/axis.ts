// Small axis helpers shared by the hand-written SVG charts.
import { useEffect, useRef, useState } from 'react';

/** Rough rendered width of a 10px axis label. */
export const labelWidth = (s: string) => s.length * 5.8 + 8;

/**
 * Indices of the labels to draw so none overlap: every `step`-th from the first,
 * plus the last (dropping its neighbour if the two would collide).
 */
export function thinLabels(labels: string[], plotWidth: number): Set<number> {
  const count = labels.length;
  if (count <= 0) return new Set();
  const widest = Math.max(...labels.map(labelWidth));
  const step = Math.max(1, Math.ceil((count * widest) / Math.max(plotWidth, 1)));
  const out = new Set<number>();
  let last = 0;
  for (let i = 0; i < count; i += step) out.add((last = i));
  if (last !== count - 1) {
    if (count - 1 - last < step) out.delete(last);
    out.add(count - 1);
  }
  return out;
}

/** A round axis maximum ≥ v, and ~3 evenly spaced ticks from 0 to it. */
export function niceScale(v: number, ticks = 3): { max: number; ticks: number[] } {
  if (!(v > 0)) return { max: 1, ticks: [0, 1] };
  const raw = v / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const max = Math.ceil(v / step) * step;
  const out: number[] = [];
  for (let t = 0; t <= max + step / 2; t += step) out.push(Number(t.toFixed(6)));
  return { max, ticks: out };
}

export function fmt(v: number): string {
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 1000)}k`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const monthName = (m: number) => MONTHS[m];

/** Measures its element's width so charts draw at real pixel size (text never scales). */
export function useWidth<T extends HTMLElement>(fallback = 300) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(120, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
