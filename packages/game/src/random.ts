export type Rng = () => number;

/** Générateur déterministe (mulberry32) : même graine, même partie, côté client comme serveur. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], r: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

/**
 * Tirage pondéré sans remise (Efraimidis-Spirakis) : n éléments, chacun d'autant plus probable que son poids est grand.
 * Déterministe pour une même suite de nombres.
 */
export function weightedSample<T>(items: readonly T[], n: number, weight: (x: T) => number, r: Rng): T[] {
  return items.map((x) => ({ x, k: Math.pow(r(), 1 / Math.max(1e-6, weight(x))) }))
    .sort((a, b) => b.k - a.k).slice(0, n).map((e) => e.x);
}

/**
 * Poids d'un département tombé il y a `ago` tirages (1 = au tirage précédent) : il peut revenir, mais rarement tout de
 * suite, puis de plus en plus ; au bout d'un tour complet (`cycle` tirages pour tout voir), comme les autres.
 * Défi du jour (10 sur 101) : un département de la veille revient environ un jour sur cinq, au lieu de presque tous les jours.
 */
export function freshness(ago: number | undefined, cycle: number): number {
  if (ago === undefined || ago >= cycle + 1) return 1;
  return Math.min(1, 0.1 + 0.9 * ((Math.max(1, ago) - 1) / cycle) ** 2);
}
