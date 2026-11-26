import { useState } from 'react';
import { levelProgress } from '../domain/character/stats.ts';
import { getDevOffsetDays } from '../domain/clock.ts';
import { currentCharacterView, wallet } from '../domain/game.ts';
import { daysLeftInSeason, isFinalBossAvailable, isInBossWindow, seasonFor } from '../domain/seasons/calendar.ts';
import { AdventureScreen } from './screens/AdventureScreen.tsx';
import { ArchiveScreen } from './screens/ArchiveScreen.tsx';
import { CharacterScreen } from './screens/CharacterScreen.tsx';
import { DevScreen } from './screens/DevScreen.tsx';
import { HabitsScreen } from './screens/HabitsScreen.tsx';
import { ProgressScreen } from './screens/ProgressScreen.tsx';
import { RewardsScreen } from './screens/RewardsScreen.tsx';
import { useStore } from './store.tsx';

const TABS = {
  habits: { label: 'Habits', Screen: HabitsScreen },
  progress: { label: 'Progress', Screen: ProgressScreen },
  character: { label: 'Character', Screen: CharacterScreen },
  adventure: { label: 'Adventure', Screen: AdventureScreen },
  rewards: { label: 'Rewards', Screen: RewardsScreen },
  archive: { label: 'Archive', Screen: ArchiveScreen },
  dev: { label: 'Dev', Screen: DevScreen },
} as const;
type TabId = keyof typeof TABS;

export function App() {
  const { data, now } = useStore();
  const [tab, setTab] = useState<TabId>('habits');
  const season = seasonFor(now);
  const w = wallet(data, now);
  const hero = currentCharacterView(data, now);
  const lp = hero && !hero.character.snapshot ? levelProgress(hero.xp) : undefined;
  const Screen = TABS[tab].Screen;
  const offset = getDevOffsetDays();

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Habit Quest</h1>
          <span className="muted">
            {season.year} · Season {season.index} · {daysLeftInSeason(now)} days left
            {hero && ` · ${hero.character.name}, Lv ${hero.level}`}
          </span>
          {lp && (
            <div className="xp mini" title={`${lp.current} / ${lp.needed} XP to level ${lp.level + 1}`}>
              <div style={{ width: `${(lp.current / lp.needed) * 100}%` }} />
            </div>
          )}
        </div>
        <div className="wallet">
          <span title="Gold: in-game currency">🪙 {w.gold}</span>
          <span title="Tokens: real-life rewards">🎟️ {w.tokens}</span>
        </div>
      </header>

      {!hero && tab !== 'character' && (
        <div className="banner prompt">
          <span>You haven't created a hero for Season {season.index} yet. Your habits are still earning XP for them.</span>
          <button className="primary small" onClick={() => setTab('character')}>Create character</button>
        </div>
      )}

      {offset !== 0 && <div className="banner dev">Dev clock: {offset > 0 ? '+' : ''}{offset} days ({now.toDateString()})</div>}
      {isFinalBossAvailable(now) ? (
        <div className="banner boss">The Final Boss has awoken. Gather your party in Adventure.</div>
      ) : (
        isInBossWindow(now) && <div className="banner boss">The season boss is here. Face it in Adventure before the season ends.</div>
      )}

      <nav className="tabs">
        {(Object.keys(TABS) as TabId[]).map((id) => (
          <button key={id} className={id === tab ? 'active' : ''} onClick={() => setTab(id)}>
            {TABS[id].label}
          </button>
        ))}
      </nav>

      <main>
        <Screen />
      </main>
    </div>
  );
}
