// Ce qu'un invité risque de perdre (sa progression n'existe que sur cet appareil) : km, étoiles, médailles, série.
import { ITEM, medalOf, starsOf } from "@hexa/game";
import type { Profile } from "@hexa/game";

export function stakeOf(p: Profile): { km: number; stars: number; medals: number; streak: number; text: string } {
  const know = p.know ?? {};
  let stars = 0, medals = 0;
  for (const c of ITEM.keys()) { stars += starsOf(know, c); if (medalOf(know, c)) medals++; }
  const km = p.xp, streak = p.streak.count;
  const parts = [
    km ? `${km.toLocaleString("fr-FR")} km` : "",
    stars ? `${stars} étoile${stars > 1 ? "s" : ""}` : "",
    medals ? `${medals} médaille${medals > 1 ? "s" : ""}` : "",
    streak >= 2 ? `ta série de ${streak} jours` : "",
  ].filter(Boolean);
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} et ${parts.at(-1)}` : (parts[0] ?? "");
  return { km, stars, medals, streak, text };
}
