// Developer tools: fake the date to test season ends and bosses, and back up your data.
import { getDevOffsetDays } from '../../domain/clock.ts';
import { emptyData } from '../../domain/game.ts';
import { bossWindowStart, makeSeason, seasonFor } from '../../domain/seasons/calendar.ts';
import { exportData, importData } from '../../data/storage.ts';
import { useStore } from '../store.tsx';

const DAY = 86_400_000;

export function DevScreen() {
  const { data, now, update, setOffset } = useStore();
  const offset = getDevOffsetDays();
  const season = seasonFor(now);

  const jumpTo = (target: Date) => setOffset(Math.ceil((target.getTime() - Date.now()) / DAY));

  return (
    <section>
      <h2>Dev tools</h2>
      <div className="card">
        <h3>Clock</h3>
        <p>
          Game date: <strong>{now.toDateString()}</strong> ({offset >= 0 ? '+' : ''}{offset} days)
        </p>
        <div className="row wrap">
          <button onClick={() => setOffset(offset + 1)}>+1 day</button>
          <button onClick={() => setOffset(offset + 7)}>+7 days</button>
          <button onClick={() => jumpTo(bossWindowStart(season))}>Go to this season's boss window</button>
          <button onClick={() => jumpTo(season.end)}>Go to next season</button>
          <button onClick={() => jumpTo(bossWindowStart(makeSeason(season.year, 4)))}>Go to Final Boss window</button>
          <button className="primary" onClick={() => setOffset(0)}>Reset to real time</button>
        </div>
        <p className="muted small">
          Logs you make while the clock is shifted are dated at the shifted time and marked as <span className="badge test">test</span> logs,
          so they can be kept out of your real rewards (below).
        </p>
      </div>

      <TestLogsCard />

      <div className="card">
        <h3>Data</h3>
        <p className="muted small">Everything is stored in this browser. Export a backup regularly.</p>
        <div className="row wrap">
          <button onClick={() => exportData(data)}>Export backup</button>
          <label className="button">
            Import backup
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file && confirm('Replace all current data with this backup?')) {
                  const restored = await importData(file);
                  update(() => restored);
                }
              }}
            />
          </label>
          <button
            className="ghost"
            onClick={() => confirm('Delete ALL data? This cannot be undone.') && update(() => emptyData())}
          >
            Wipe all data
          </button>
        </div>
      </div>
    </section>
  );
}

function TestLogsCard() {
  const { data, update } = useStore();
  const count = data.logs.filter((l) => l.test).length;
  return (
    <div className="card">
      <h3>Test logs</h3>
      <p className="small">
        {count === 0 ? 'No test logs.' : `${count} test log${count === 1 ? '' : 's'} saved.`}
        {data.devOffsetDays !== 0 && ' The dev clock is shifted, so test logs are counted right now.'}
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={data.settings.excludeTestLogs}
          onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, excludeTestLogs: e.target.checked } }))}
        />
        Leave test logs out of rewards while the clock is real
      </label>
      <button
        className="ghost"
        disabled={count === 0}
        onClick={() =>
          confirm(`Delete ${count} test log${count === 1 ? '' : 's'}? Real logs are kept.`) &&
          update((d) => ({ ...d, logs: d.logs.filter((l) => !l.test) }))
        }
      >
        Delete all test logs
      </button>
    </div>
  );
}
