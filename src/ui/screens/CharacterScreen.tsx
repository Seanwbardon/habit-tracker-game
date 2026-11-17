import { useState } from 'react';
import { CLASSES, getClass } from '../../config/classes.ts';
import { getItem } from '../../config/enemies.ts';
import { REWARDS } from '../../config/rewards.ts';
import { STATS, STAT_INFO } from '../../config/stats.ts';
import { levelProgress } from '../../domain/character/stats.ts';
import { currentCharacterView } from '../../domain/game.ts';
import { seasonFor } from '../../domain/seasons/calendar.ts';
import { newId, useStore } from '../store.tsx';

export function CharacterScreen() {
  const { data, now } = useStore();
  const view = currentCharacterView(data, now);
  return view ? <CharacterSheet /> : <CreateCharacter />;
}

function CreateCharacter() {
  const { data, now, update } = useStore();
  const [name, setName] = useState('');
  const [classId, setClassId] = useState(CLASSES[0].id);
  const season = seasonFor(now);
  const habits = data.habits.filter((h) => !h.archivedAt);

  const create = () =>
    update((d) => ({
      ...d,
      characters: [
        ...d.characters,
        { id: newId(), seasonId: season.id, name: name.trim(), classId, createdAt: now.toISOString(), equipment: [] },
      ],
    }));

  return (
    <section>
      <h2>Create your Season {season.index} hero</h2>
      <p className="muted">
        Pick any class. Choose one whose primary stats match the habits you want to work on this season.
      </p>
      <div className="grid">
        {CLASSES.map((c) => {
          const feeding = habits.filter((h) => c.primaryStats.includes(h.primaryStat) || c.primaryStats.includes(h.secondaryStat));
          return (
            <button key={c.id} className={`card class-card ${classId === c.id ? 'selected' : ''}`} onClick={() => setClassId(c.id)}>
              <h3>{c.name}</h3>
              <p className="small">{c.description}</p>
              <p className="small">
                <strong>Primary:</strong> {c.primaryStats.map((s) => STAT_INFO[s].name).join(', ')}
              </p>
              <p className="small muted">Suggested habits: {c.suggestedHabits.join(', ')}</p>
              {habits.length > 0 && (
                <p className="small">
                  <strong>Your habits that feed it:</strong> {feeding.length ? feeding.map((h) => h.name).join(', ') : 'none yet'}
                </p>
              )}
            </button>
          );
        })}
      </div>
      <div className="row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hero name" />
        <button className="primary" disabled={!name.trim()} onClick={create}>Begin Season {season.index}</button>
      </div>
    </section>
  );
}

function CharacterSheet() {
  const { data, now, update } = useStore();
  const view = currentCharacterView(data, now)!;
  const c = view.character;
  const cls = getClass(c.classId);
  const lp = levelProgress(view.xp);

  const equip = (itemId: string) =>
    update((d) => {
      const item = getItem(itemId);
      if (!item || item.slot === 'consumable') return d;
      const idx = d.inventory.indexOf(itemId);
      if (idx < 0) return d;
      const inventory = [...d.inventory];
      inventory.splice(idx, 1);
      // One item per slot: put the old one back in the bag.
      const replaced = c.equipment.filter((e) => getItem(e)?.slot === item.slot);
      const equipment = [...c.equipment.filter((e) => getItem(e)?.slot !== item.slot), itemId];
      return {
        ...d,
        inventory: [...inventory, ...replaced],
        characters: d.characters.map((x) => (x.id === c.id ? { ...x, equipment } : x)),
      };
    });

  const unequip = (itemId: string) =>
    update((d) => ({
      ...d,
      inventory: [...d.inventory, itemId],
      characters: d.characters.map((x) => (x.id === c.id ? { ...x, equipment: x.equipment.filter((e) => e !== itemId) } : x)),
    }));

  return (
    <section>
      <h2>{c.name}</h2>
      <p className="muted">Level {view.level} {cls.name} · {cls.description}</p>
      <div className="card">
        <div className="row between">
          <strong>Level {lp.level}</strong>
          <span className="muted small">{lp.current} / {lp.needed} XP to level {lp.level + 1}</span>
        </div>
        <div className="xp"><div style={{ width: `${(lp.current / lp.needed) * 100}%` }} /></div>
      </div>

      <div className="card">
        <h3>Stats</h3>
        <table className="stats">
          <tbody>
            {STATS.map((s) => {
              const xp = view.xp[s] ?? 0;
              const into = xp % REWARDS.xpPerStatPoint;
              return (
                <tr key={s} className={cls.primaryStats.includes(s) ? 'primary-stat' : ''}>
                  <th>{s}</th>
                  <td>{STAT_INFO[s].name}</td>
                  <td className="num">{view.stats[s]}</td>
                  <td>
                    <div className="xp stat" title={`${into} / ${REWARDS.xpPerStatPoint} XP to +1 ${s}`}>
                      <div style={{ width: `${(into / REWARDS.xpPerStatPoint) * 100}%` }} />
                    </div>
                    <span className="muted small">base {cls.baseStats[s]} · {REWARDS.xpPerStatPoint - into} XP to +1</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted small">Stats grow when habit periods close. Highlighted rows are this class's primary stats.</p>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Equipped</h3>
          {c.equipment.length === 0 && <p className="muted small">Nothing equipped.</p>}
          {c.equipment.map((id) => (
            <div key={id} className="row between">
              <span>{getItem(id)?.name ?? id}</span>
              <button className="small" onClick={() => unequip(id)}>Unequip</button>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Bag</h3>
          {data.inventory.length === 0 && <p className="muted small">Empty. Win encounters or visit the shop.</p>}
          {data.inventory.map((id, i) => {
            const item = getItem(id);
            return (
              <div key={`${id}-${i}`} className="row between">
                <span>{item?.name ?? id}</span>
                {item && item.slot !== 'consumable' && <button className="small" onClick={() => equip(id)}>Equip</button>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
