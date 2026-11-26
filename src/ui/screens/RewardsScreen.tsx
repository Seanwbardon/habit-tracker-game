import { useState } from 'react';
import { LOOT } from '../../config/enemies.ts';
import { fullLedger, wallet } from '../../domain/game.ts';
import { newId, useStore } from '../store.tsx';

export function RewardsScreen() {
  const { data, now, update } = useStore();
  const [name, setName] = useState('');
  const [cost, setCost] = useState(50);
  const w = wallet(data, now);
  const history = fullLedger(data, now)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 15);

  const redeem = (id: string, rewardCost: number) =>
    update((d) => ({
      ...d,
      ledger: [...d.ledger, { id: newId(), currency: 'tokens', amount: -rewardCost, source: 'redeem', ref: id, at: now.toISOString() }],
    }));

  const buy = (itemId: string, price: number) =>
    update((d) => ({
      ...d,
      inventory: [...d.inventory, itemId],
      ledger: [...d.ledger, { id: newId(), currency: 'gold', amount: -price, source: 'shop', ref: itemId, at: now.toISOString() }],
    }));

  const addReward = () => {
    if (!name.trim() || cost <= 0) return;
    update((d) => ({ ...d, realRewards: [...d.realRewards, { id: newId(), name: name.trim(), cost }] }));
    setName('');
  };

  return (
    <section>
      <h2>Rewards</h2>
      <div className="grid">
        <div className="card">
          <h3>🎟️ Real-life rewards ({w.tokens} Tokens)</h3>
          <p className="muted small">Tokens only come from habits, never from encounters.</p>
          {w.rawTokens < 0 && <Recovering amount={-w.rawTokens} what="Tokens" />}
          {data.realRewards.map((r) => (
            <div key={r.id} className="row between">
              <span>{r.name} · {r.cost}</span>
              <span className="row">
                <button className="small primary" disabled={w.rawTokens < r.cost} onClick={() => redeem(r.id, r.cost)}>Redeem</button>
                <button
                  className="small ghost"
                  onClick={() => update((d) => ({ ...d, realRewards: d.realRewards.filter((x) => x.id !== r.id) }))}
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
          <div className="row">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New reward" />
            <input type="number" className="narrow" min={1} value={cost} onChange={(e) => setCost(Number(e.target.value))} />
            <button onClick={addReward}>Add</button>
          </div>
        </div>

        <div className="card">
          <h3>🪙 Shop ({w.gold} Gold)</h3>
          {w.rawGold < 0 && <Recovering amount={-w.rawGold} what="Gold" />}
          {LOOT.filter((i) => i.price).map((i) => (
            <div key={i.id} className="row between">
              <span>
                {i.name} <span className="muted small">{Object.entries(i.bonus).map(([k, v]) => `+${v} ${k}`).join(' ')}</span>
              </span>
              <button className="small" disabled={w.rawGold < i.price!} onClick={() => buy(i.id, i.price!)}>{i.price}</button>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Recent history</h3>
          {history.length === 0 && <p className="muted small">Nothing yet.</p>}
          {history.map((e) => (
            <div key={e.id} className="row between small">
              <span>{e.at.slice(0, 10)} · {e.source}</span>
              <span className={e.amount < 0 ? 'neg' : 'pos'}>
                {e.amount > 0 ? '+' : ''}{e.amount} {e.currency === 'gold' ? '🪙' : '🎟️'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Shown when a rebalance pushed the real balance below zero (it's displayed as 0). */
function Recovering({ amount, what }: { amount: number; what: string }) {
  return (
    <p className="note small">
      ⓘ Reward values changed, so you've spent {amount} more {what} than your habits now earn. Purchases unlock once that's earned back.
    </p>
  );
}
