// Habit creation. The player picks stats and difficulty; the app suggests stats,
// shows which classes use them, and previews the reward the rules engine will give.
import { useState } from 'react';
import { classesUsingStat } from '../../config/classes.ts';
import { STATS, STAT_INFO, type StatId } from '../../config/stats.ts';
import { suggestStats } from '../../domain/habits/suggest.ts';
import { previewHabitReward } from '../../domain/rules/rewards.ts';
import type { Difficulty, Habit, HabitKind, Period } from '../../domain/types.ts';
import { newId } from '../store.tsx';

interface Props {
  currentClassId?: string;
  now: Date;
  onSave: (h: Habit) => void;
  onCancel: () => void;
}

export function HabitForm({ currentClassId, now, onSave, onCancel }: Props) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<HabitKind>('build');
  const [target, setTarget] = useState(5);
  const [unit, setUnit] = useState('hours');
  const [period, setPeriod] = useState<Period>('weekly');
  // Stats follow the suggestions until the player picks one themselves.
  const [primaryOverride, setPrimary] = useState<StatId | undefined>();
  const [secondaryOverride, setSecondary] = useState<StatId | undefined>();
  const [difficulty, setDifficulty] = useState<Difficulty>(3);

  const suggestions = suggestStats(name, currentClassId);
  const suggestedPrimary = suggestions[0]?.stat ?? STATS[0];
  const suggestedSecondary = suggestions[1]?.stat ?? STATS.find((s) => s !== suggestedPrimary)!;
  const primaryStat = primaryOverride ?? suggestedPrimary;
  const secondaryStat = secondaryOverride ?? suggestedSecondary;
  const overridden = primaryStat !== suggestedPrimary || secondaryStat !== suggestedSecondary;
  const preview = previewHabitReward({ period, difficulty, primaryStat, secondaryStat });
  const sameStat = primaryStat === secondaryStat;
  const valid = name.trim() && target >= 0 && !sameStat;

  const useSuggestion = () => {
    setPrimary(undefined);
    setSecondary(undefined);
  };

  const save = () => {
    if (!valid) return;
    onSave({
      id: newId(), name: name.trim(), kind, target, unit, period,
      primaryStat, secondaryStat, difficulty, createdAt: now.toISOString(),
    });
  };

  return (
    <div className="card form">
      <h3>New habit</h3>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Study, Smoking, Gym" />
      </label>

      <div className="row">
        <label>
          Type
          <select value={kind} onChange={(e) => setKind(e.target.value as HabitKind)}>
            <option value="build">Build (reach a target)</option>
            <option value="limit">Limit (stay at or under, ≤)</option>
          </select>
        </label>
        <label>
          {kind === 'build' ? 'Target' : 'At most'}
          <input type="number" min={0} step="any" value={target} onChange={(e) => setTarget(Number(e.target.value))} />
        </label>
        <label>
          Unit
          <input value={unit} onChange={(e) => setUnit(e.target.value)} />
        </label>
        <label>
          Per
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="daily">day</option>
            <option value="weekly">week</option>
            <option value="monthly">month</option>
          </select>
        </label>
      </div>

      {suggestions.length > 0 && overridden && (
        <div className="suggest">
          <span>
            Suggested for this habit: <strong>{suggestedPrimary} + {suggestedSecondary}</strong>
          </span>
          <button className="small" onClick={useSuggestion}>Use</button>
        </div>
      )}
      {suggestions.length > 0 && !overridden && (
        <p className="muted small">Stats suggested from the habit name. Change them if you like.</p>
      )}

      <div className="row">
        <StatPicker label="Primary stat (70%)" value={primaryStat} onChange={setPrimary} />
        <StatPicker label="Secondary stat (30%)" value={secondaryStat} onChange={setSecondary} />
      </div>
      {sameStat && <p className="error">Pick two different stats.</p>}

      <label>
        Difficulty: {difficulty}
        <input type="range" min={1} max={5} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value) as Difficulty)} />
      </label>

      <p className="preview">
        Full {period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month'}: +{preview.primaryXp} {primaryStat} XP,
        +{preview.secondaryXp} {secondaryStat} XP, 🪙 {preview.gold}, 🎟️ {preview.tokens}
        {preview.perfectWeekXp > 0 && <><br />Perfect week (all 7 days): +{preview.perfectWeekXp} bonus XP</>}
        {preview.progressXp > 0 && (
          <><br />Paid daily as you progress (up to {preview.progressXp} XP), plus +{preview.completionXp} bonus XP when the {period === 'weekly' ? 'week' : 'month'}'s target is met</>
        )}
      </p>

      <div className="row end">
        <button onClick={onCancel}>Cancel</button>
        <button className="primary" disabled={!valid} onClick={save}>Create habit</button>
      </div>
    </div>
  );
}

function StatPicker({ label, value, onChange }: { label: string; value: StatId; onChange: (s: StatId) => void }) {
  const users = classesUsingStat(value).map((c) => c.name);
  return (
    <label className="grow">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as StatId)}>
        {STATS.map((s) => (
          <option key={s} value={s}>{s} · {STAT_INFO[s].name}</option>
        ))}
      </select>
      <span className="muted small">
        {STAT_INFO[value].description} {users.length ? `Primary for: ${users.join(', ')}.` : ''}
      </span>
    </label>
  );
}
