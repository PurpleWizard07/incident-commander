/**
 * Deterministic PRNG (mulberry32). Every random draw in this package must go
 * through an Rng instance seeded from (scenarioId, seed) — never Math.random(),
 * never Date.now(), never crypto.randomUUID(). That is what makes the same
 * (scenario, seed) pair reproduce a byte-identical world (plan §4.2).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Combine an arbitrary string key and a numeric seed into one 32-bit int seed.
 * Callers pass a composite key like `${scenarioId}:metric:checkout:error_rate`
 * so each independent generation concern gets its OWN rng stream — see world.ts.
 */
export function deriveSeed(key: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 2654435761);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export class Rng {
  private readonly next: () => number;

  constructor(seed: number) {
    this.next = mulberry32(seed);
  }

  /** Uniform float in [0, 1). */
  float(): number {
    return this.next();
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** true with probability p (default 0.5). */
  bool(p = 0.5): boolean {
    return this.next() < p;
  }

  /** Pick one element deterministically. Throws on an empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick: empty array");
    return items[this.int(0, items.length - 1)];
  }

  /** Deterministic short hex id, e.g. for trace/span ids. Not a real UUID. */
  hexId(bytes = 8): string {
    let out = "";
    for (let i = 0; i < bytes * 2; i++) {
      out += this.int(0, 15).toString(16);
    }
    return out;
  }
}
