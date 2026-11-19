// Départements tirés lors des dernières parties d'entraînement (sur cet appareil) : ils reviennent moins vite
// (tirage pondéré, voir freshness dans @hexa/game). Les séances, composées à part, ne sont pas concernées.
const KEY = "hexa.recent", KEEP = 12;

function load(): string[][] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v.filter(Array.isArray) : []; } catch { return []; }
}

/** Pour chaque département récent : il y a combien de parties (1 = la précédente). */
export function recentAges(): Record<string, number> {
  const out: Record<string, number> = {};
  load().forEach((codes, i) => { for (const c of codes) if (typeof c === "string") out[c] ??= i + 1; });
  return out;
}

export function remember(codes: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify([codes, ...load()].slice(0, KEEP))); } catch { /* navigation privée */ }
}
