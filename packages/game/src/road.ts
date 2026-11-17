// Les kilomètres (ex-XP) : Hexa fait le tour de France de ville en ville, en boucle.
// Une barre d'expérience sans niveaux numérotés : chaque tronçon (200 à 560 km) se parcourt en une à trois séances.
// Distances routières approximatives.
export const ROUTE: { city: string; km: number }[] = [
  { city: "Paris", km: 0 },
  { city: "Lille", km: 225 },
  { city: "Strasbourg", km: 520 },
  { city: "Lyon", km: 490 },
  { city: "Marseille", km: 315 },
  { city: "Nice", km: 200 },
  { city: "Toulouse", km: 560 },
  { city: "Bordeaux", km: 245 },
  { city: "Nantes", km: 345 },
  { city: "Brest", km: 300 },
  { city: "Rennes", km: 245 },
  { city: "Paris", km: 350 },
];
export const LAP_KM = ROUTE.reduce((n, s) => n + s.km, 0);

export interface Trip { from: string; to: string; ratio: number; left: number; lap: number }

/** Où en est Hexa : le tronçon en cours, la part parcourue, ce qui reste, et le numéro du tour de France. */
export function roadTrip(km: number): Trip {
  const total = Math.max(0, km);
  const lap = Math.floor(total / LAP_KM) + 1;
  let rest = total % LAP_KM;
  for (let i = 1; i < ROUTE.length; i++) {
    const leg = ROUTE[i].km;
    if (rest < leg) return { from: ROUTE[i - 1].city, to: ROUTE[i].city, ratio: rest / leg, left: leg - rest, lap };
    rest -= leg;
  }
  return { from: "Paris", to: "Lille", ratio: 0, left: ROUTE[1].km, lap };
}

/** Villes atteintes entre deux totaux (pour l'écran de fin). */
export function citiesReached(before: number, after: number): string[] {
  const out: string[] = [];
  let at = 0;
  for (let lap = 0; at <= after; lap++) {
    for (let i = 1; i < ROUTE.length; i++) {
      at = lap * LAP_KM + ROUTE.slice(1, i + 1).reduce((n, s) => n + s.km, 0);
      if (at > after) return out;
      if (at > before) out.push(ROUTE[i].city);
    }
  }
  return out;
}
