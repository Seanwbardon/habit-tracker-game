// Enemy templates for daily encounters. Stats scale with the player's level.

export interface EnemyTemplate {
  id: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  /** Relative chance of being picked. */
  weight: number;
}

export const ENEMIES: EnemyTemplate[] = [
  { id: 'slime', name: 'Slime', hp: 30, atk: 6, def: 2, spd: 3, weight: 5 },
  { id: 'goblin', name: 'Goblin', hp: 40, atk: 9, def: 4, spd: 7, weight: 4 },
  { id: 'wolf', name: 'Dire Wolf', hp: 45, atk: 11, def: 3, spd: 10, weight: 3 },
  { id: 'skeleton', name: 'Skeleton', hp: 55, atk: 10, def: 7, spd: 5, weight: 3 },
  { id: 'imp', name: 'Procrastination Imp', hp: 35, atk: 13, def: 2, spd: 12, weight: 2 },
];

export interface LootItem {
  id: string;
  name: string;
  slot: 'weapon' | 'armour' | 'trinket' | 'consumable';
  bonus: Partial<Record<'atk' | 'def' | 'hp' | 'spd', number>>;
  /** Relative drop chance. */
  weight: number;
  /** Shop price in Gold. Omit to make an item drop-only. */
  price?: number;
}

export const LOOT: LootItem[] = [
  { id: 'potion', name: 'Potion', slot: 'consumable', bonus: { hp: 30 }, weight: 6, price: 15 },
  { id: 'rusty-sword', name: 'Rusty Sword', slot: 'weapon', bonus: { atk: 2 }, weight: 3, price: 60 },
  { id: 'leather-vest', name: 'Leather Vest', slot: 'armour', bonus: { def: 2 }, weight: 3, price: 60 },
  { id: 'lucky-charm', name: 'Lucky Charm', slot: 'trinket', bonus: { spd: 1 }, weight: 1 },
  { id: 'steel-blade', name: 'Steel Blade', slot: 'weapon', bonus: { atk: 5 }, weight: 0, price: 220 },
  { id: 'chainmail', name: 'Chainmail', slot: 'armour', bonus: { def: 5 }, weight: 0, price: 220 },
];

export function getItem(id: string): LootItem | undefined {
  return LOOT.find((l) => l.id === id);
}
