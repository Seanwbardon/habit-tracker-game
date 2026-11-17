import { useState } from 'react';
import { getItem } from '../../config/enemies.ts';
import { freezeCharacter } from '../../domain/character/stats.ts';
import { generateDailyEncounter, type Encounter } from '../../domain/encounters/generator.ts';
import { currentCharacterView, finalBossParty, recentScore, wallet } from '../../domain/game.ts';
import { finalBossEncounter, finalBossScaling, seasonBossEncounter } from '../../domain/seasons/bosses.ts';
import { isFinalBossAvailable, isInBossWindow, seasonFor } from '../../domain/seasons/calendar.ts';
import { toDateKey } from '../../domain/time.ts';
import type { CharacterSnapshot } from '../../domain/types.ts';
import { Battle } from '../components/Battle.tsx';
import { newId, useStore } from '../store.tsx';

interface Fight {
  encounter: Encounter;
  party: CharacterSnapshot[];
  result?: { outcome: 'won' | 'lost'; gold: number; loot: string[] };
  saved?: boolean;
}

export function AdventureScreen() {
  const { data, now, update } = useStore();
  const [fight, setFight] = useState<Fight | null>(null);
  const [saveTitle, setSaveTitle] = useState('');
  const view = currentCharacterView(data, now);

  if (!view) return <p className="muted">Create this season's character first (Character tab).</p>;

  const hero = freezeCharacter(view, now);
  const season = seasonFor(now);
  const daily = generateDailyEncounter({
    userId: data.userId,
    dateKey: toDateKey(now),
    level: view.level,
    recentScore: recentScore(data, now),
  });
  const done = (id: string) => data.completedEncounters.includes(id);

  const finish = (outcome: 'won' | 'lost') => {
    if (!fight) return;
    const enc = fight.encounter;
    let gold = 0;
    let loot: string[] = [];
    if (outcome === 'won') {
      // Daily encounters are capped so they never out-earn your habits.
      gold = enc.kind === 'daily' ? Math.min(enc.gold, wallet(data, now).encounterGoldLeft) : enc.gold;
      loot = enc.loot;
      const source = enc.kind === 'daily' ? 'encounter' : 'boss';
      update((d) => ({
        ...d,
        completedEncounters: [...d.completedEncounters, enc.id],
        inventory: [...d.inventory, ...loot],
        ledger: gold
          ? [...d.ledger, { id: newId(), currency: 'gold', amount: gold, source, ref: enc.id, at: now.toISOString() }]
          : d.ledger,
      }));
    }
    setFight({ ...fight, result: { outcome, gold, loot } });
  };

  const saveEncounter = () => {
    if (!fight) return;
    update((d) => ({
      ...d,
      savedEncounters: [
        ...d.savedEncounters,
        { id: newId(), title: saveTitle.trim() || fight.encounter.id, savedAt: now.toISOString(), encounter: fight.encounter, party: fight.party },
      ],
    }));
    setFight({ ...fight, saved: true });
    setSaveTitle('');
  };

  if (fight) {
    return (
      <section>
        <h2>{fight.encounter.enemies.map((e) => e.name).join(', ')}</h2>
        {/* key resets the battle if a new fight starts */}
        <Battle key={fight.encounter.id + fight.party.length} encounter={fight.encounter} party={fight.party} onEnd={finish} />
        {fight.result && (
          <div className="card">
            <h3>{fight.result.outcome === 'won' ? 'Victory!' : 'Defeated'}</h3>
            {fight.result.outcome === 'won' && (
              <p>
                🪙 +{fight.result.gold}
                {fight.encounter.kind === 'daily' && fight.result.gold < fight.encounter.gold && ' (capped: keep up your habits to raise the cap)'}
                {fight.result.loot.length > 0 && ` · Loot: ${fight.result.loot.map((l) => getItem(l)?.name).join(', ')}`}
              </p>
            )}
            {fight.result.outcome === 'lost' && <p className="muted">No penalty. Try again whenever you like.</p>}
            <div className="row">
              {!fight.saved ? (
                <>
                  <input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} placeholder="Name this encounter" />
                  <button onClick={saveEncounter}>Save encounter</button>
                </>
              ) : (
                <span className="muted">Saved to the Archive.</span>
              )}
              <button className="primary" onClick={() => setFight(null)}>Back</button>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
      <h2>Adventure</h2>
      <div className="grid">
        <div className="card">
          <h3>Today's encounter</h3>
          <p className="small">{daily.enemies.map((e) => e.name).join(', ')}</p>
          <p className="muted small">
            Gold offered: {daily.gold} (you can earn {wallet(data, now).encounterGoldLeft} more from encounters this week)
          </p>
          {done(daily.id) ? (
            <p className="muted">Cleared. A new encounter appears tomorrow.</p>
          ) : (
            <button className="primary" onClick={() => setFight({ encounter: daily, party: [hero] })}>Fight</button>
          )}
        </div>

        {isInBossWindow(now) && (
          <SeasonBossCard
            encounter={seasonBossEncounter(season, view.level)}
            heroName={hero.name}
            done={done(`boss-${season.id}`)}
            onFight={(encounter) => setFight({ encounter, party: [hero] })}
          />
        )}
        {isFinalBossAvailable(now) && (
          <FinalBossCard
            year={season.year}
            pool={finalBossParty(data, now)}
            done={done(`final-${season.year}`)}
            onFight={(party) => setFight({ encounter: finalBossEncounter(season.year, party), party })}
          />
        )}
      </div>
    </section>
  );
}

function SeasonBossCard({ encounter, heroName, done, onFight }: {
  encounter: Encounter; heroName: string; done: boolean; onFight: (e: Encounter) => void;
}) {
  return (
    <div className="card boss-card">
      <h3>Season boss: {encounter.enemies[0].name}</h3>
      <p className="small">One final fight for {heroName} before the season ends.</p>
      {done ? <p className="muted">Defeated!</p> : (
        <button className="primary" onClick={() => onFight(encounter)}>Challenge</button>
      )}
    </div>
  );
}

function FinalBossCard({ year, pool, done, onFight }: {
  year: number; pool: CharacterSnapshot[]; done: boolean; onFight: (party: CharacterSnapshot[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(() => pool.map((p) => p.characterId));
  const party = pool.filter((p) => picked.includes(p.characterId));
  const sc = finalBossScaling(party);
  return (
    <div className="card boss-card">
      <h3>Final Boss</h3>
      <p className="small">Your heroes from {year}:</p>
      {pool.map((p) => (
        <label key={p.characterId} className="check">
          <input
            type="checkbox"
            checked={picked.includes(p.characterId)}
            onChange={(e) => setPicked(e.target.checked ? [...picked, p.characterId] : picked.filter((x) => x !== p.characterId))}
          />
          {p.name} (Lv {p.level}, {p.seasonId.slice(5)})
        </label>
      ))}
      <p className="muted small">
        Party of {party.length}/4: boss strength ×{sc.strength.toFixed(2)}, rewards ×{sc.rewardFactor}
      </p>
      {done ? <p className="muted">The year is won!</p> : (
        <button className="primary" disabled={party.length === 0} onClick={() => onFight(party)}>Face the Final Boss</button>
      )}
    </div>
  );
}
