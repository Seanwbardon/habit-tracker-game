// Full view of one habit (all versions of its edit chain): heatmap, history, stats, logs.
import { useState } from 'react';
import { chainOf } from '../../domain/habits/chain.ts';
import { countedLogs, rewardLogs } from '../../domain/game.ts';
import { habitStats, heatmap, streaks, chainResults } from '../../domain/habits/history.ts';
import type { Habit } from '../../domain/types.ts';
import { fmt, shortDate } from '../components/charts/axis.ts';
import { Heatmap } from '../components/charts/Heatmap.tsx';
import { HabitChart, periodLabel } from '../components/HabitChart.tsx';
import { useStore } from '../store.tsx';

const PER = { daily: 'day', weekly: 'week', monthly: 'month' } as const;

export function HabitDetail({ habit, onBack }: { habit: Habit; onBack: () => void }) {
  const { data, now, update } = useStore();
  const [showAll, setShowAll] = useState(false);
  const chain = chainOf(data.habits, habit.id);
  const ids = new Set(chain.map((h) => h.id));
  const logs = rewardLogs(data);
  const counted = new Set(countedLogs(data).map((l) => l.id));
  const year = now.getFullYear();
  const heat = heatmap(chain, logs, year, now);
  const stats = habitStats(chain, logs, now);
  const s = streaks(chainResults(chain, logs, now));
  const mine = data.logs.filter((l) => ids.has(l.habitId)).sort((a, b) => b.at.localeCompare(a.at));
  const shown = showAll ? mine : mine.slice(0, 20);
  const unit = habit.unit;
  const best = stats.bestPeriod;

  const del = (id: string) => {
    if (confirm('Delete this log? Rewards for its period will be recalculated.'))
      update((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== id) }));
  };

  return (
    <section className="detail">
      <div className="row between">
        <button onClick={onBack}>‹ Back to habits</button>
        <span className="tag">{habit.primaryStat}/{habit.secondaryStat} · ★{habit.difficulty}</span>
      </div>
      <h2>{habit.name}</h2>
      <p className="muted small">
        {habit.kind === 'build' ? 'Goal' : 'Limit'}: {habit.kind === 'limit' && '≤ '}{habit.target} {unit} per {PER[habit.period]}
        {chain.length > 1 && ` · ${chain.length} versions`}
      </p>

      <div className="tiles">
        <Tile label="Completion rate" value={stats.completionRate === null ? '–' : `${Math.round(stats.completionRate * 100)}%`}
          sub={stats.closedPeriods ? `of ${stats.closedPeriods} closed` : 'no closed periods yet'} />
        <Tile label="Average per period" value={stats.averagePerPeriod === null ? '–' : fmt(stats.averagePerPeriod)} sub={unit} />
        <Tile label="Best period" value={best ? fmt(best.total) : '–'}
          sub={best ? `${unit}, ${periodLabel(new Date(best.start), best.periodKey.split('/')[1] as Habit['period'])}` : ''} />
        <Tile label="Total logged" value={fmt(stats.totalLogged)} sub={unit} />
        <Tile label="Streak" value={String(s.current)} sub={`best ${s.best}`} />
      </div>

      <div className="card">
        <h3>{year}</h3>
        <Heatmap cells={heat.cells} weeks={heat.weeks} unit={unit} year={year} />
      </div>

      <div className="card">
        <h3>History</h3>
        <HabitChart chain={chain} logs={logs} now={now} height={170} defaultRange="year" />
      </div>

      {chain.length > 1 && (
        <div className="card">
          <h3>Versions</h3>
          <p className="muted small">Edits that change rewards apply from the period they were made in; older periods keep their old rules.</p>
          <ul className="versions small">
            {chain.map((v) => (
              <li key={v.id}>
                From {shortDate(new Date(v.createdAt))} {new Date(v.createdAt).getFullYear()}: {v.kind === 'limit' ? '≤ ' : ''}{v.target} {v.unit} per {PER[v.period]},{' '}
                {v.primaryStat}/{v.secondaryStat}, ★{v.difficulty}
                {v.archivedAt ? ` (until ${shortDate(new Date(v.archivedAt))})` : ' (current)'}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h3>Logs ({mine.length})</h3>
        {mine.length === 0 && <p className="muted small">Nothing logged yet.</p>}
        <ul className="log-list">
          {shown.map((l) => (
            <li key={l.id}>
              <span className="when">{new Date(l.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span className="amt">{fmt(l.amount)} {unit}</span>
              <span className="badges">
                {l.test && <span className="badge test" title="Logged while the dev clock was shifted">test</span>}
                {!counted.has(l.id) && <span className="badge off" title="Test logs don't count while the clock is real (Dev → settings)">not counted</span>}
              </span>
              <button className="small ghost" onClick={() => del(l.id)} aria-label="Delete log">Delete</button>
            </li>
          ))}
        </ul>
        {mine.length > shown.length && <button className="small" onClick={() => setShowAll(true)}>Show all {mine.length}</button>}
      </div>
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tile">
      <span className="muted small">{label}</span>
      <strong>{value}</strong>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}
