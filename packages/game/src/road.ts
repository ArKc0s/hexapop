// Les kilomètres (ex-XP) sur deux échelles, communes à tous les atlas :
// - la route : Hexa roule d'une escale à la suivante (200 à 3 100 km), ça bouge à chaque séance ;
// - le grand voyage : le tour de France, puis les Antilles et la Guyane, l'océan Indien, le tour du monde, et on recommence.
// France : distances routières approximatives. Ensuite : à vol d'oiseau, calculées depuis les coordonnées des escales.
export interface Voyage { name: string; stops: { city: string; km: number }[] }
export const VOYAGES: Voyage[] = [
  { name: "Le tour de France", stops: [
    { city: "Paris", km: 0 }, { city: "Lille", km: 225 }, { city: "Strasbourg", km: 520 }, { city: "Lyon", km: 490 },
    { city: "Marseille", km: 315 }, { city: "Nice", km: 200 }, { city: "Toulouse", km: 560 }, { city: "Bordeaux", km: 245 },
    { city: "Nantes", km: 345 }, { city: "Brest", km: 300 }, { city: "Rennes", km: 245 }, { city: "Paris", km: 350 },
  ] },
  { name: "Les Antilles et la Guyane", stops: [
    { city: "Paris", km: 0 }, { city: "Les Açores", km: 2560 }, { city: "La mer des Sargasses", km: 1920 }, { city: "Les Bermudes", km: 1875 },
    { city: "Pointe-à-Pitre", km: 1815 }, { city: "Fort-de-France", km: 190 }, { city: "Cayenne", km: 1440 },
  ] },
  { name: "L'océan Indien", stops: [
    { city: "Cayenne", km: 0 }, { city: "Fernando de Noronha", km: 2420 }, { city: "L'île de l'Ascension", km: 2050 }, { city: "Sainte-Hélène", km: 1290 },
    { city: "Le Cap", km: 3135 }, { city: "Durban", km: 1270 }, { city: "Fort-Dauphin", km: 1660 }, { city: "Saint-Denis de La Réunion", km: 980 },
    { city: "Mamoudzou", km: 1410 },
  ] },
  { name: "Le tour du monde", stops: [
    { city: "Mamoudzou", km: 0 }, { city: "Les Seychelles", km: 1445 }, { city: "Les Maldives", km: 2230 }, { city: "Colombo", km: 765 },
    { city: "Singapour", km: 2735 }, { city: "Bali", km: 1675 }, { city: "Darwin", km: 1760 }, { city: "Cairns", km: 1680 },
    { city: "Nouméa", km: 2245 }, { city: "Wallis", km: 2090 }, { city: "Papeete", km: 2890 }, { city: "Pitcairn", km: 2180 },
    { city: "L'île de Pâques", km: 2080 }, { city: "Juan Fernández", km: 3005 }, { city: "Lima", km: 2410 }, { city: "Panama", km: 2355 },
    { city: "Miami", km: 1865 }, { city: "New York", km: 1760 }, { city: "Saint-Pierre", km: 1580 }, { city: "Les Açores", km: 2685 },
    { city: "Paris", km: 2560 },
  ] },
];
const voyageKm = (v: Voyage) => v.stops.reduce((n, s) => n + s.km, 0);
/** Un cycle complet des grands voyages. */
export const CYCLE_KM = VOYAGES.reduce((n, v) => n + voyageKm(v), 0);

export interface Trip {
  /** Tronçon en cours. */
  from: string; to: string; ratio: number; left: number;
  /** Grand voyage en cours : nom, escale atteinte (sur le nombre de tronçons), part parcourue, et le suivant. */
  voyage: string; leg: number; legs: number; voyageRatio: number; nextVoyage: string;
  /** Numéro du cycle (2 et plus : on refait les grands voyages). */
  cycle: number;
}

export function roadTrip(km: number): Trip {
  const total = Math.max(0, km);
  const cycle = Math.floor(total / CYCLE_KM) + 1;
  let rest = total % CYCLE_KM;
  for (let vi = 0; vi < VOYAGES.length; vi++) {
    const v = VOYAGES[vi], len = voyageKm(v);
    if (rest >= len) { rest -= len; continue; }
    const into = rest;
    for (let i = 1; i < v.stops.length; i++) {
      const leg = v.stops[i].km;
      if (rest < leg) return {
        from: v.stops[i - 1].city, to: v.stops[i].city, ratio: rest / leg, left: leg - rest,
        voyage: v.name, leg: i, legs: v.stops.length - 1, voyageRatio: into / len, nextVoyage: VOYAGES[(vi + 1) % VOYAGES.length].name, cycle,
      };
      rest -= leg;
    }
  }
  return roadTrip(0);
}

/** Escales atteintes et grands voyages terminés entre deux totaux (pour l'écran de fin). */
export function tripEvents(before: number, after: number): { cities: string[]; voyages: string[] } {
  const cities: string[] = [], voyages: string[] = [];
  let at = Math.floor(Math.max(0, before) / CYCLE_KM) * CYCLE_KM;
  while (at <= after) {
    for (const v of VOYAGES) {
      for (const s of v.stops.slice(1)) {
        at += s.km;
        if (at > after) return { cities, voyages };
        if (at > before) cities.push(s.city);
      }
      if (at > before) voyages.push(v.name);
    }
  }
  return { cities, voyages };
}
