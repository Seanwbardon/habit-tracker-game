// Deterministic randomness: same seed → same encounter, same battle.

/** FNV-1a 32-bit string hash. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 step: returns [value in 0..1, next state]. Pure, so battle state can carry it. */
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Convenience stateful wrapper for generators. */
export function makeRng(seed: number) {
  let state = seed >>> 0;
  return {
    next(): number {
      const [v, s] = nextRandom(state);
      state = s;
      return v;
    },
    int(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pickWeighted<T extends { weight: number }>(items: T[]): T {
      const total = items.reduce((s, i) => s + i.weight, 0);
      let r = this.next() * total;
      for (const item of items) {
        r -= item.weight;
        if (r < 0) return item;
      }
      return items[items.length - 1];
    },
  };
}
