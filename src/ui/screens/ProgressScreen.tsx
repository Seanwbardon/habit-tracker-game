// Season-level progress: stat growth, Gold/Tokens over time, weekly completion.
import { useState } from 'react';
import { getClass } from '../../config/classes.ts';
import { STATS, STAT_INFO } from '../../config/stats.ts';
import { fullLedger, rewardLogs } from '../../domain/game.ts';
import { balanceHistory, seasonRange, seasonStatGrowth, weeklyCompletion } from '../../domain/habits/history.ts';
import { makeSeason, seasonFor } from '../../domain/seasons/calendar.ts';
import type { Currency } from '../../domain/types.ts';
import { fmt, shortDate } from '../components/charts/axis.ts';
import { BarChart } from '../components/charts/BarChart.tsx';
import { LineChart } from '../components/charts/LineChart.tsx';
import { useStore } from '../store.tsx';

/** Every season from the first habit/character up to the current one, newest first. */
function seasonOptions(firstDate: Date, now: Date): string[] {
  const out: string[] = [];
  const current = seasonFor(now);
  for (let s = seasonFor(firstDate); s.start <= current.start; s = seasonFor(s.end)) out.unshift(s.id);
  return out;
}

export function ProgressScreen() {
  const { data, now } = useStore();
  const firstDates = [
    ...data.habits.map((h) => new Date(h.createdAt)),
    ...data.characters.map((c) => { const [y, s] = c.seasonId.split('-S').map(Number); return makeSeason(y, s as 1 | 2 | 3 | 4).start; }),
  ].filter((d) => d <= now);
  const first = firstDates.length ? new Date(Math.min(...firstDates.map((d) => d.getTime()))) : now;
  const options = seasonOptions(first, now);
  const [picked, setPicked] = useState(options[0]);
  const seasonId = options.includes(picked) ? picked : options[0];
  const range = seasonRange(seasonId, now);
  const character = data.characters.find((c) => c.seasonId === seasonId);
  const primary: string[] = character ? getClass(character.classId).primaryStats : [];
  const logs = rewardLogs(data);
  const label = (id: string) => {
    const [y, s] = id.split('-S');
    const c = data.characters.find((x) => x.seasonId === id);
    return `${y} · Season ${s}${id === seasonFor(now).id ? ' (now)' : c?.snapshot ? ' (archived)' : ''}`;
  };

  const growth = seasonStatGrowth(data.habits, logs, now, seasonId);
  const weekLabels = growth.weeks.map((w) => shortDate(w.start));
  const completion = weeklyCompletion(data.habits, logs, now, range.start, range.end);
  const ledger = fullLedger(data, now);

  return (
    <section>
      <div className="row between">
        <h2>Progress</h2>
        <label className="inline">
          <span className="muted small">Season</span>
          <select value={seasonId} onChange={(e) => setPicked(e.target.value)}>
            {options.map((id) => <option key={id} value={id}>{label(id)}</option>)}
          </select>
        </label>
      </div>

      <div className="card">
        <h3>Stat growth</h3>
        <p className="muted small">
          Cumulative XP by week.{' '}
          {character
            ? <>Thick solid lines are {character.name}'s class stats ({primary.join(', ')}).</>
            : 'No character this season, so no class stats are highlighted.'}
        </p>
        <LineChart
          ariaLabel="Cumulative XP per stat by week"
          xLabels={weekLabels}
          xTitles={growth.weeks.map((w) => `week of ${shortDate(w.start)}`)}
          unit=" XP"
          series={STATS.map((s, i) => ({
            id: s,
            label: s,
            values: growth.series[s],
            colorClass: `s${i + 1}`,
            emphasis: primary.includes(s),
            dash: primary.includes(s) ? undefined : '4 3',
          }))}
          empty="No XP earned this season yet. It lands as periods close."
        />
        <p className="muted small legend-note">{STATS.map((s) => `${s} = ${STAT_INFO[s].name}`).join(' · ')}</p>
      </div>

      <div className="grid two">
        <BalanceCard title="🪙 Gold" currency="gold" ledger={ledger} from={range.start} until={range.end} />
        <BalanceCard title="🎟️ Tokens" currency="tokens" ledger={ledger} from={range.start} until={range.end} />
      </div>

      <div className="card">
        <h3>Weekly completion</h3>
        <p className="muted small">Share of all habit periods that closed that week with the target met.</p>
        <BarChart
          ariaLabel="Weekly completion rate"
          max={100}
          formatY={(v) => `${v}%`}
          height={110}
          empty="No weeks in this season yet."
          bars={completion.map((w) => ({
            key: w.start.toISOString(),
            label: shortDate(w.start),
            value: w.rate === null ? 0 : Math.round(w.rate * 100),
            state: w.rate === null ? 'none' : 'neutral',
            title: w.rate === null
              ? `Week of ${shortDate(w.start)}: no periods closed`
              : `Week of ${shortDate(w.start)}: ${w.achieved} of ${w.periods} periods met (${Math.round(w.rate * 100)}%)`,
          }))}
        />
      </div>
    </section>
  );
}

function BalanceCard({ title, currency, ledger, from, until }: {
  title: string; currency: Currency; ledger: ReturnType<typeof fullLedger>; from: Date; until: Date;
}) {
  const pts = balanceHistory(ledger, currency, from, until);
  const name = currency === 'gold' ? 'Gold' : 'Tokens';
  // Shown balances never go below zero (see wallet()).
  const values = pts.map((p) => Math.max(0, p.balance));
  const spent = pts.reduce((s, p) => s + p.spent, 0);
  return (
    <div className="card">
      <h3>{title}</h3>
      <p className="muted small">Running balance. ▼ marks a day with spending{spent ? ` (${fmt(spent)} spent this season)` : ''}.</p>
      <LineChart
        ariaLabel={`${name} balance over the season`}
        height={130}
        xLabels={pts.map((p) => shortDate(p.date))}
        unit={` ${name}`}
        series={[{ id: currency, label: name, values, colorClass: currency === 'gold' ? 's4' : 's1' }]}
        markers={pts.flatMap((p, i) => (p.spent > 0 ? [{ index: i, value: values[i], title: `${shortDate(p.date)}: spent ${fmt(p.spent)}, earned ${fmt(p.earned)} ${name}` }] : []))}
        empty={`No ${name} this season yet.`}
      />
    </div>
  );
}
