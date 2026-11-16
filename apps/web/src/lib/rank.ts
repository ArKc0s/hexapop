/** Rangs selon le nombre de départements maîtrisés. */
export const RANKS = [
  { min: 0, name: "Touriste" },
  { min: 10, name: "Routard" },
  { min: 30, name: "Facteur" },
  { min: 55, name: "Sous-préfet" },
  { min: 80, name: "Préfet" },
  { min: 101, name: "Géomètre de l'IGN" },
];

export function rankFor(mastered: number) {
  let i = 0;
  while (i + 1 < RANKS.length && mastered >= RANKS[i + 1].min) i++;
  const next = RANKS[i + 1];
  return { name: RANKS[i].name, next: next?.name ?? null, toNext: next ? next.min - mastered : 0 };
}
