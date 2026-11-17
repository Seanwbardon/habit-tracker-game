// Turn-based combat as a pure function: step(state, action) → new state.
// No randomness outside the state's own rngState, so any battle can be
// replayed exactly from its starting state + list of actions.
import { LOOT } from '../../config/enemies.ts';
import type { StatId } from '../../config/stats.ts';
import { nextRandom } from '../encounters/rng.ts';

export interface Combatant {
  id: string;
  name: string;
  side: 'party' | 'enemy';
  maxHp: number;
  hp: number;
  maxMp: number;
  mp: number;
  atk: number;
  mag: number;
  heal: number;
  def: number;
  spd: number;
  crit: number;
  defending: boolean;
}

export type Action =
  | { type: 'attack'; actorId: string; targetId: string }
  | { type: 'magic'; actorId: string; targetId: string }
  | { type: 'heal'; actorId: string; targetId: string }
  | { type: 'defend'; actorId: string };

export interface BattleState {
  round: number;
  rngState: number;
  party: Combatant[];
  enemies: Combatant[];
  /** Index into living party members whose turn it is. */
  activeIndex: number;
  log: string[];
  outcome: 'ongoing' | 'won' | 'lost';
}

export const MAGIC_COST = 5;
export const HEAL_COST = 6;

/** Converts character stats (+ equipped items) into combat numbers. Tune here. */
export function combatantFromStats(
  id: string,
  name: string,
  stats: Record<StatId, number>,
  equipment: string[] = [],
): Combatant {
  const gear = equipment
    .map((itemId) => LOOT.find((l) => l.id === itemId))
    .filter((x) => x && x.slot !== 'consumable');
  const bonus = (k: 'atk' | 'def' | 'hp' | 'spd') => gear.reduce((s, g) => s + (g?.bonus[k] ?? 0), 0);

  const maxHp = 30 + stats.CON * 6 + bonus('hp');
  const maxMp = 10 + stats.WIS * 2;
  return {
    id,
    name,
    side: 'party',
    maxHp,
    hp: maxHp,
    maxMp,
    mp: maxMp,
    atk: stats.STR * 2 + bonus('atk'),
    mag: stats.INT * 2,
    heal: stats.WIS * 2,
    def: stats.WIS + Math.floor(stats.CON / 2) + bonus('def'),
    spd: stats.DEX + bonus('spd'),
    crit: Math.min(0.3, stats.DEX * 0.01 + stats.CHA * 0.005),
    defending: false,
  };
}

export function createBattle(party: Combatant[], enemies: Combatant[], seed: number): BattleState {
  return {
    round: 1,
    rngState: seed >>> 0,
    party: party.map((c) => ({ ...c })),
    enemies: enemies.map((c) => ({ ...c })),
    activeIndex: 0,
    log: ['The battle begins!'],
    outcome: 'ongoing',
  };
}

const alive = (cs: Combatant[]) => cs.filter((c) => c.hp > 0);

export function activeMember(state: BattleState): Combatant | undefined {
  return alive(state.party)[state.activeIndex];
}

export function step(prev: BattleState, action: Action): BattleState {
  if (prev.outcome !== 'ongoing') return prev;
  const s: BattleState = structuredClone(prev);
  const actor = activeMember(s);
  if (!actor || actor.id !== action.actorId) return prev; // not this member's turn

  actor.defending = false;
  performAction(s, actor, action);
  checkOutcome(s);
  if (s.outcome !== 'ongoing') return s;

  // Next living party member, or enemies' turn.
  s.activeIndex += 1;
  if (s.activeIndex >= alive(s.party).length) {
    enemyTurn(s);
    checkOutcome(s);
    s.activeIndex = 0;
    s.round += 1;
  }
  return s;
}

export function replay(initial: BattleState, actions: Action[]): BattleState {
  return actions.reduce(step, initial);
}

function roll(s: BattleState): number {
  const [v, next] = nextRandom(s.rngState);
  s.rngState = next;
  return v;
}

function find(s: BattleState, id: string): Combatant | undefined {
  return [...s.party, ...s.enemies].find((c) => c.id === id);
}

function dealDamage(s: BattleState, attacker: Combatant, target: Combatant, power: number, defWeight: number): void {
  const variance = 0.85 + roll(s) * 0.3;
  const isCrit = roll(s) < attacker.crit;
  let dmg = Math.max(1, Math.round(power * variance - target.def * defWeight));
  if (isCrit) dmg = Math.round(dmg * 1.5);
  if (target.defending) dmg = Math.max(1, Math.round(dmg / 2));
  target.hp = Math.max(0, target.hp - dmg);
  s.log.push(`${attacker.name} hits ${target.name} for ${dmg}${isCrit ? ' (critical!)' : ''}.`);
  if (target.hp === 0) s.log.push(`${target.name} falls.`);
}

function performAction(s: BattleState, actor: Combatant, action: Action): void {
  switch (action.type) {
    case 'defend':
      actor.defending = true;
      s.log.push(`${actor.name} defends.`);
      return;
    case 'attack': {
      const t = find(s, action.targetId);
      if (t && t.hp > 0) dealDamage(s, actor, t, actor.atk, 0.5);
      return;
    }
    case 'magic': {
      const t = find(s, action.targetId);
      if (!t || t.hp <= 0) return;
      if (actor.mp < MAGIC_COST) {
        s.log.push(`${actor.name} is out of MP!`);
        return;
      }
      actor.mp -= MAGIC_COST;
      dealDamage(s, actor, t, actor.mag * 1.4, 0.25);
      return;
    }
    case 'heal': {
      const t = find(s, action.targetId);
      if (!t || t.hp <= 0) return;
      if (actor.mp < HEAL_COST) {
        s.log.push(`${actor.name} is out of MP!`);
        return;
      }
      actor.mp -= HEAL_COST;
      const amount = Math.round(8 + actor.heal * (1 + roll(s) * 0.3));
      t.hp = Math.min(t.maxHp, t.hp + amount);
      s.log.push(`${actor.name} heals ${t.name} for ${amount}.`);
      return;
    }
  }
}

function enemyTurn(s: BattleState): void {
  const order = alive(s.enemies).sort((a, b) => b.spd - a.spd);
  for (const enemy of order) {
    const targets = alive(s.party);
    if (targets.length === 0) return;
    const target = targets[Math.floor(roll(s) * targets.length)];
    dealDamage(s, enemy, target, enemy.atk, 0.5);
  }
  for (const p of s.party) p.defending = false;
}

function checkOutcome(s: BattleState): void {
  if (alive(s.enemies).length === 0) {
    s.outcome = 'won';
    s.log.push('Victory!');
  } else if (alive(s.party).length === 0) {
    s.outcome = 'lost';
    s.log.push('Your party was defeated…');
  }
}
