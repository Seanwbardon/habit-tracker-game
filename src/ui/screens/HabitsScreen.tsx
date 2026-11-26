import { useState } from 'react';
import { chainHeads, chainOf, editHabit, logWindow } from '../../domain/habits/chain.ts';
import { currentCharacter, rewardLogs, type AppData } from '../../domain/game.ts';
import { currentProgress } from '../../domain/habits/evaluate.ts';
import { periodEnd, periodStart, toDateKey } from '../../domain/time.ts';
import type { Habit, HabitLog } from '../../domain/types.ts';
import { shortDate } from '../components/charts/axis.ts';
import { HabitChart } from '../components/HabitChart.tsx';
import { HabitForm } from '../components/HabitForm.tsx';
import { newId, useStore } from '../store.tsx';
import { HabitDetail } from './HabitDetail.tsx';

export function HabitsScreen() {
  const { data, now, update } = useStore();
  const [adding, setAdding] = useState(false);
  const [detailId, setDetailId] = useState<string>();
  const habits = chainHeads(data.habits).filter((h) => !h.archivedAt);

  const detail = detailId && habits.find((h) => chainOf(data.habits, h.id).some((v) => v.id === detailId));
  if (detail) return <HabitDetail habit={detail} onBack={() => setDetailId(undefined)} />;

  return (
    <section>
      <div className="row between">
        <h2>Habits</h2>
        {!adding && <button className="primary" onClick={() => setAdding(true)}>+ New habit</button>}
      </div>

      {adding && (
        <HabitForm
          now={now}
          currentClassId={currentCharacter(data, now)?.classId}
          onCancel={() => setAdding(false)}
          onSave={(h) => {
            update((d) => ({ ...d, habits: [...d.habits, h] }));
            setAdding(false);
          }}
        />
      )}

      {habits.length === 0 && !adding && (
        <p className="muted">No habits yet. Add one: they power everything else in the game.</p>
      )}

      <div className="grid">
        {habits.map((h) => (
          <HabitCard key={h.id} habit={h} onOpen={() => setDetailId(h.id)} />
        ))}
      </div>
    </section>
  );
}

/** Builds a log for `dateKey` (YYYY-MM-DD): now if it's today, else midday that day. */
export function makeLog(d: AppData, habit: Habit, dateKey: string, amount: number, now: Date): HabitLog {
  const [y, m, day] = dateKey.split('-').map(Number);
  const at = dateKey === toDateKey(now) ? now : new Date(y, m - 1, day, 12);
  return {
    id: newId(), habitId: habit.id, at: at.toISOString(), amount,
    ...(d.devOffsetDays !== 0 ? { test: true as const } : {}),
  };
}

/** If `log` landed in an already-closed period, a one-line note saying so. */
export function backfillNote(chain: Habit[], log: HabitLog, now: Date): string | undefined {
  const at = new Date(log.at);
  const t = at.getTime();
  const version = chain.find((v) => { const w = logWindow(v); return t >= w.start && t < w.end; }) ?? chain[chain.length - 1];
  const end = periodEnd(periodStart(at, version.period), version.period);
  if (end > now) return undefined;
  const what = { daily: 'day', weekly: 'week', monthly: 'month' }[version.period];
  return `Logged to ${shortDate(at)}: that ${what} has already closed, so its rewards were recalculated.`;
}

function HabitCard({ habit, onOpen }: { habit: Habit; onOpen: () => void }) {
  const { data, now, update } = useStore();
  const [amount, setAmount] = useState(1);
  const today = toDateKey(now);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState<string>();
  const [editing, setEditing] = useState(false);
  const chain = chainOf(data.habits, habit.id);
  const chainIds = new Set(chain.map((h) => h.id));
  const logs = rewardLogs(data);
  const progress = currentProgress(habit, logs, now);
  const pct = Math.min(100, (progress.total / Math.max(habit.target, 1)) * 100);
  const over = habit.kind === 'limit' && progress.total > habit.target;
  const per = { daily: 'today', weekly: 'this week', monthly: 'this month' }[habit.period];
  const firstDay = toDateKey(new Date(chain[0].createdAt));
  const logDate = date > today ? today : date; // the clock may have moved back

  const log = () => {
    const entry = makeLog(data, habit, logDate, amount, now);
    setNote(backfillNote(chain, entry, now));
    update((d) => ({ ...d, logs: [...d.logs, entry] }));
  };

  const undo = () =>
    update((d) => {
      const mine = d.logs.filter((l) => chainIds.has(l.habitId));
      const last = mine[mine.length - 1];
      return last ? { ...d, logs: d.logs.filter((l) => l !== last) } : d;
    });

  const remove = () => {
    if (confirm(`Delete “${habit.name}”? Its history will be permanently removed.`))
      update((d) => ({
        ...d,
        habits: d.habits.filter((x) => !chainIds.has(x.id)),
        logs: d.logs.filter((l) => !chainIds.has(l.habitId)),
      }));
  };

  if (editing)
    return (
      <HabitForm
        initial={habit}
        now={now}
        onCancel={() => setEditing(false)}
        onSave={(h) => {
          const { name, kind, target, unit, period, primaryStat, secondaryStat, difficulty } = h;
          update((d) => ({
            ...d,
            habits: editHabit(d.habits, habit.id, { name, kind, target, unit, period, primaryStat, secondaryStat, difficulty }, now, newId),
          }));
          setEditing(false);
        }}
      />
    );

  return (
    <div className="card habit-card">
      <div className="row between">
        <h3>
          <button className="link" onClick={onOpen} title="Open details">{habit.name} ›</button>
        </h3>
        <span className="tag">{habit.primaryStat}/{habit.secondaryStat} · ★{habit.difficulty}</span>
      </div>
      <p className="small">
        {habit.kind === 'build' ? 'Goal' : 'Limit'}: {habit.kind === 'limit' && 'at most (≤) '}
        {habit.target} {habit.unit} per {{ daily: 'day', weekly: 'week', monthly: 'month' }[habit.period]}
      </p>
      <div className={`progress ${habit.kind} ${over ? 'over' : ''}`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <p className="small">
        {progress.total} / {habit.target} {habit.unit} {per}
        {over && ' (over the limit)'}
      </p>
      <div className="row">
        <input type="number" className="narrow" min={0} step="any" value={amount} aria-label="Amount" onChange={(e) => setAmount(Number(e.target.value))} />
        <input
          type="date"
          className="date"
          value={logDate}
          min={firstDay}
          max={today}
          aria-label="Date to log"
          onChange={(e) => setDate(e.target.value || today)}
        />
        <button className="primary" onClick={log}>Log</button>
      </div>
      {note && <p className="note small">ⓘ {note}</p>}
      <div className="row">
        <button className="small" onClick={undo}>Undo last</button>
        <button className="small" onClick={() => setEditing(true)}>Edit</button>
        <button className="small ghost" onClick={remove}>Delete</button>
        {data.devOffsetDays !== 0 && <span className="badge test" title="Logs made now are marked as test data">test mode</span>}
      </div>
      <HabitChart chain={chain} logs={logs} now={now} />
    </div>
  );
}
