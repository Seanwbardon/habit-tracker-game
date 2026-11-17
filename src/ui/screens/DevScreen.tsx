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
          Logs you make while the clock is shifted are dated at the shifted time. Use a separate browser profile, or back up first, if you
          don't want test data mixed in with your real habits.
        </p>
      </div>

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
