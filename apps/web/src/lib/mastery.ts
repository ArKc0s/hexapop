import type { Progress } from "@hexa/game";

/** Couleur de maîtrise d'un département selon sa boîte de Leitner. */
export function masteryFills(p: Progress): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [code, s] of Object.entries(p)) {
    out[code] = s.box >= 4 ? "var(--blue)" : s.box >= 2 ? "var(--yellow)" : "#ffd0e7";
  }
  return out;
}
