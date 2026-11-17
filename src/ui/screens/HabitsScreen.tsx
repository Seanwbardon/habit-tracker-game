import { useState } from 'react';
import { currentCharacter } from '../../domain/game.ts';
import { closedResults, currentProgress } from '../../domain/habits/evaluate.ts';
import type { Habit } from '../../domain/types.ts';
import { HabitChart } from '../components/HabitChart.tsx';
import { HabitForm } from '../components/HabitForm.tsx';
import { newId, useStore } from '../store.tsx';

export function HabitsScreen() {
  const { data, now, update } = useStore();
  const [adding, setAdding] = useState(false);
  const habits = data.habits.filter((h) => !h.archivedAt);

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
          <HabitCard key={h.id} habit={h} />
        ))}
      </div>
    </section>
  );
}

function HabitCard({ habit }: { habit: Habit }) {
  const { data, now, update } = useStore();
  const [amount, setAmount] = useState(1);
  const progress = currentProgress(habit, data.logs, now);
  const history = closedResults(habit, data.logs, now).slice(-8);
  const pct = Math.min(100, (progress.total / Math.max(habit.target, 1)) * 100);
  const over = habit.kind === 'limit' && progress.total > habit.target;
  const per = { daily: 'today', weekly: 'this week', monthly: 'this month' }[habit.period];

  const log = () =>
    update((d) => ({ ...d, logs: [...d.logs, { id: newId(), habitId: habit.id, at: now.toISOString(), amount }] }));

  const undo = () =>
    update((d) => {
      const mine = d.logs.filter((l) => l.habitId === habit.id);
      const last = mine[mine.length - 1];
      return last ? { ...d, logs: d.logs.filter((l) => l !== last) } : d;
    });

  const remove = () => {
    if (confirm(`Delete “${habit.name}”? Its history will be permanently removed.`))
      update((d) => ({
        ...d,
        habits: d.habits.filter((x) => x.id !== habit.id),
        logs: d.logs.filter((log) => log.habitId !== habit.id),
      }));
  };

  return (
    <div className="card">
      <div className="row between">
        <h3>{habit.name}</h3>
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
        <input type="number" className="narrow" min={0} step="any" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        <button className="primary" onClick={log}>Log</button>
        <button onClick={undo}>Undo last</button>
        <button className="ghost" onClick={remove}>Delete</button>
      </div>
      <HabitChart habit={habit} results={history} />
    </div>
  );
}
