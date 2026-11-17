// Les kilomètres (ex-XP) : une route avec des étapes réelles, pour qu'on voie que ça avance
// comme une barre d'expérience, sans niveaux numérotés. Distances approximatives (route depuis Paris, puis à vol d'oiseau).
export interface Stop { km: number; name: string; trip: string }
export const ROAD: Stop[] = [
  { km: 0, name: "Paris", trip: "Le départ" },
  { km: 130, name: "Orléans", trip: "Paris → Orléans" },
  { km: 225, name: "Lille", trip: "Paris → Lille" },
  { km: 385, name: "Nantes", trip: "Paris → Nantes" },
  { km: 465, name: "Lyon", trip: "Paris → Lyon" },
  { km: 585, name: "Bordeaux", trip: "Paris → Bordeaux" },
  { km: 775, name: "Marseille", trip: "Paris → Marseille" },
  { km: 930, name: "Nice", trip: "Paris → Nice" },
  { km: 1200, name: "Paris-Brest-Paris", trip: "La randonnée Paris-Brest-Paris" },
  { km: 3400, name: "Tour de France", trip: "Un Tour de France cycliste" },
  { km: 6750, name: "Pointe-à-Pitre", trip: "Paris → la Guadeloupe" },
  { km: 9350, name: "Saint-Denis de La Réunion", trip: "Paris → La Réunion" },
  { km: 40075, name: "Tour de la Terre", trip: "Le tour de la Terre" },
  { km: 384400, name: "La Lune", trip: "La Terre → la Lune" },
];

/** Où en est Hexa sur la route : dernière étape franchie, prochaine, et la part du tronçon parcourue. */
export function roadTrip(km: number): { last: Stop; next: Stop | null; ratio: number; left: number } {
  let i = 0;
  while (i + 1 < ROAD.length && km >= ROAD[i + 1].km) i++;
  const last = ROAD[i], next = ROAD[i + 1] ?? null;
  return { last, next, ratio: next ? (km - last.km) / (next.km - last.km) : 1, left: next ? next.km - km : 0 };
}

/** Étapes franchies entre deux totaux (pour l'écran de fin). */
export function stopsPassed(before: number, after: number): Stop[] {
  return ROAD.filter((s) => s.km > before && s.km <= after);
}
