import { useState } from 'react';
import { getClass } from '../../config/classes.ts';
import { STATS } from '../../config/stats.ts';
import type { SavedEncounter } from '../../domain/game.ts';
import { seasonsOfYear } from '../../domain/seasons/calendar.ts';
import { Battle } from '../components/Battle.tsx';
import { useStore } from '../store.tsx';

export function ArchiveScreen() {
  const { data, now, update } = useStore();
  const [replaying, setReplaying] = useState<SavedEncounter | null>(null);
  const [replayDone, setReplayDone] = useState(false);
  // Bumped only by "Fight again" — remounts <Battle> for a fresh fight.
  // (Keying on replayDone remounted it the moment a fight ended, forcing a second fight.)
  const [attempt, setAttempt] = useState(0);

  const years = [...new Set([now.getFullYear(), ...data.characters.map((c) => Number(c.seasonId.slice(0, 4)))])].sort((a, b) => b - a);

  if (replaying) {
    return (
      <section>
        <h2>Replay: {replaying.title}</h2>
        <p className="muted small">Replays give no rewards.</p>
        <Battle key={`${replaying.id}:${attempt}`} encounter={replaying.encounter} party={replaying.party} onEnd={() => setReplayDone(true)} />
        <div className="row">
          {replayDone && <button onClick={() => { setReplayDone(false); setAttempt((n) => n + 1); }}>Fight again</button>}
          <button className="primary" onClick={() => { setReplaying(null); setReplayDone(false); }}>Back</button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2>Archive</h2>
      {years.map((year) => (
        <div key={year}>
          <h3>{year}</h3>
          <div className="grid">
            {seasonsOfYear(year).map((s) => {
              const c = data.characters.find((x) => x.seasonId === s.id);
              return (
                <div key={s.id} className={`card ${c ? '' : 'empty'}`}>
                  <h4>Season {s.index}</h4>
                  {!c && <p className="muted small">No character this season.</p>}
                  {c && (
                    <>
                      <p>
                        <strong>{c.name}</strong> · {getClass(c.classId).name}
                        {c.snapshot ? ` · Lv ${c.snapshot.level}` : ' · in progress'}
                      </p>
                      {c.snapshot && (
                        <p className="small muted">{STATS.map((st) => `${st} ${c.snapshot!.stats[st]}`).join(' · ')}</p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <h3>Saved encounters</h3>
      {data.savedEncounters.length === 0 && <p className="muted small">Save a fight you enjoyed from its results screen.</p>}
      {data.savedEncounters.map((s) => (
        <div key={s.id} className="card row between">
          <span>
            <strong>{s.title}</strong>{' '}
            <span className="muted small">{s.savedAt.slice(0, 10)} · {s.party.map((p) => p.name).join(', ')}</span>
          </span>
          <span className="row">
            <button className="small primary" onClick={() => setReplaying(s)}>Replay</button>
            <button
              className="small ghost"
              onClick={() => confirm(`Delete “${s.title}”?`) && update((d) => ({ ...d, savedEncounters: d.savedEncounters.filter((x) => x.id !== s.id) }))}
            >
              Delete
            </button>
          </span>
        </div>
      ))}
    </section>
  );
}
