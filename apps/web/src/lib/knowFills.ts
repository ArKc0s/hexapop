// Couleurs de « Ta France » sur la carte : découvert, 1-2 étoiles, médailles, à réviser.
// Partagé par l'accueil et l'Album (onglet Carte).
import { DEPARTEMENTS, fadingCodes, medalOf, starsOf, type Knowledge } from "@hexa/game";

export const STAR_FILL = ["", "#dcebf8", "#b6d6f1"];
export const MEDAL_FILL = ["", "#e6b98e", "#b4bfcd", "#f5c518"];
export const SEEN_FILL = "#eef3f8";

export function knowFills(know: Knowledge, now: number): Record<string, string> {
  const fading = new Set(fadingCodes(know, now));
  return Object.fromEntries(DEPARTEMENTS.map((d) => d.code).flatMap((c) => {
    const m = medalOf(know, c), s = starsOf(know, c);
    if (!s) return know[c] && Object.values(know[c]).some((x) => x?.v) ? [[c, SEEN_FILL]] : [];
    if (fading.has(c)) return [[c, "var(--tint-ko)"]];
    return [[c, m ? MEDAL_FILL[m] : STAR_FILL[s]]];
  }));
}
