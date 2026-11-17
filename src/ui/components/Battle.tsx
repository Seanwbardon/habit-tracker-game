// Battle view. All rules live in the pure combat engine; this only draws state and sends actions.
import { useState } from 'react';
import {
  activeMember, combatantFromStats, createBattle, HEAL_COST, MAGIC_COST, step,
  type Action, type BattleState, type Combatant,
} from '../../domain/combat/engine.ts';
import type { Encounter } from '../../domain/encounters/generator.ts';
import type { CharacterSnapshot } from '../../domain/types.ts';

interface Props {
  encounter: Encounter;
  party: CharacterSnapshot[];
  onEnd: (outcome: 'won' | 'lost', actions: Action[]) => void;
}

export function startBattle(encounter: Encounter, party: CharacterSnapshot[]): BattleState {
  const members = party.map((p) => ({
    ...combatantFromStats(p.characterId, p.name, p.stats, p.equipment),
  }));
  return createBattle(members, encounter.enemies, encounter.seed);
}

export function Battle({ encounter, party, onEnd }: Props) {
  const [state, setState] = useState(() => startBattle(encounter, party));
  const [actions, setActions] = useState<Action[]>([]);
  const [targetId, setTargetId] = useState<string | undefined>();
  const me = activeMember(state);
  const livingEnemies = state.enemies.filter((e) => e.hp > 0);
  const target = livingEnemies.find((e) => e.id === targetId) ?? livingEnemies[0];

  const act = (type: Action['type']) => {
    if (!me) return;
    let action: Action;
    if (type === 'defend') action = { type, actorId: me.id };
    else if (type === 'heal') {
      const ally = state.party.filter((p) => p.hp > 0).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      action = { type, actorId: me.id, targetId: ally.id };
    } else action = { type, actorId: me.id, targetId: target.id };

    const next = step(state, action);
    const all = [...actions, action];
    setState(next);
    setActions(all);
    if (next.outcome !== 'ongoing') onEnd(next.outcome, all);
  };

  return (
    <div className="battle card">
      <div className="side enemies">
        {state.enemies.map((e) => (
          <Unit key={e.id} c={e} selected={e.id === target?.id} onClick={() => e.hp > 0 && setTargetId(e.id)} />
        ))}
      </div>
      <div className="side party">
        {state.party.map((p) => (
          <Unit key={p.id} c={p} active={p.id === me?.id && state.outcome === 'ongoing'} />
        ))}
      </div>

      {state.outcome === 'ongoing' && me && (
        <div className="row actions">
          <span>Round {state.round}: <strong>{me.name}</strong>'s turn</span>
          <button className="primary" onClick={() => act('attack')}>Attack</button>
          <button disabled={me.mp < MAGIC_COST} onClick={() => act('magic')}>Magic ({MAGIC_COST} MP)</button>
          <button disabled={me.mp < HEAL_COST} onClick={() => act('heal')}>Heal ({HEAL_COST} MP)</button>
          <button onClick={() => act('defend')}>Defend</button>
        </div>
      )}

      <ol className="log">
        {state.log.slice(-8).map((line, i) => (
          <li key={state.log.length - 8 + i}>{line}</li>
        ))}
      </ol>
    </div>
  );
}

function Unit({ c, active, selected, onClick }: { c: Combatant; active?: boolean; selected?: boolean; onClick?: () => void }) {
  return (
    <div className={`unit ${c.hp === 0 ? 'down' : ''} ${active ? 'active' : ''} ${selected ? 'selected' : ''}`} onClick={onClick}>
      <strong>{c.name}</strong>
      <div className="hp"><div style={{ width: `${(c.hp / c.maxHp) * 100}%` }} /></div>
      <span className="small">HP {c.hp}/{c.maxHp}{c.maxMp > 0 && ` · MP ${c.mp}/${c.maxMp}`}</span>
    </div>
  );
}
