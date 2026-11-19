// Niveau du joueur par atlas, appris de ses réponses (à la façon d'un classement Elo) : chaque réponse le fait
// monter ou descendre selon qu'elle était attendue ou non. Il bouge vite au début (quelques réponses suffisent à
// passer des pays célèbres aux pays moins connus), puis se stabilise. Les découvertes sont choisies là où le joueur
// réussit environ 3 fois sur 4 : ni trop facile, ni décourageant.
import { ITEM } from "./data.ts";

export interface Skill { /** Niveau, de 0 (débutant) à 1 (tout connaître). */ t: number; /** Réponses prises en compte. */ n: number }
export const NEW_SKILL: Skill = { t: 0.25, n: 0 };

/**
 * Difficulté a priori (0 facile à 1 difficile), avant d'avoir des réponses : la notoriété pour les pays ; pour les
 * départements et les régions, une estimation simple (l'outre-mer et la petite couronne sont plus durs à placer).
 */
export function prior(code: string): number | undefined {
  const it = ITEM.get(code);
  if (!it) return undefined;
  if (it.rang !== undefined) return Math.min(1, Math.max(0, (it.rang - 22) / 96));
  if (code.startsWith("R")) return it.outreMer ? 0.45 : 0.25;
  if (it.outreMer) return 0.55;
  if (code === "75") return 0.1;
  if (["92", "93", "94", "91", "95", "78", "77"].includes(code)) return 0.5;
  return 0.4;
}

/** Difficulté apprise des erreurs de tous les joueurs (GET /api/difficulty), qui remplace l'a priori quand elle existe. */
let learned: Record<string, number> = {};
export function setDifficulties(table: Record<string, number>) {
  learned = {};
  for (const [c, d] of Object.entries(table ?? {})) if (ITEM.has(c) && Number.isFinite(d)) learned[c] = Math.min(1, Math.max(0, d));
}

/** Difficulté d'un élément (0 facile à 1 difficile), tous atlas. */
export function difficulty(code: string): number | undefined {
  return learned[code] ?? prior(code);
}

/**
 * Mélange de l'a priori et du taux d'erreur observé, pondéré par le nombre de réponses (20 réponses comptent autant
 * que l'a priori) : peu de données, on bouge peu ; beaucoup, on suit les joueurs.
 */
export function blendDifficulty(code: string, seen: number, correct: number): number | undefined {
  const p = prior(code);
  if (p === undefined || seen <= 0) return p;
  const err = 1 - Math.min(seen, correct) / seen;
  return Math.round(((p * 20 + err * seen) / (20 + seen)) * 1000) / 1000;
}

/** Chance de réussir un élément de difficulté d pour un joueur de niveau t. */
export const expected = (t: number, d: number) => 1 / (1 + Math.exp(-6 * (t - d)));

/** Nouveau niveau après ces réponses (précision de 0 à 1). Les éléments sans difficulté connue sont ignorés. */
export function updateSkill(s: Skill | undefined, answers: readonly { code: string; accuracy: number }[]): Skill {
  let { t, n } = s ?? NEW_SKILL;
  for (const a of answers) {
    const d = difficulty(a.code);
    if (d === undefined || !Number.isFinite(a.accuracy)) continue;
    const k = Math.max(0.05, 0.45 / Math.sqrt(1 + n / 3));
    t = Math.min(1.2, Math.max(-0.2, t + k * (Math.min(1, Math.max(0, a.accuracy)) - expected(t, d))));
    n += 1;
  }
  return { t: Math.round(t * 1000) / 1000, n };
}

/** Ordre de découverte : au plus près de la difficulté visée (réussite ≈ 75 %), avec un peu de hasard. */
export function byFit(codes: readonly string[], t: number, r: () => number): string[] {
  const target = t - 0.18; // expected(t, t - 0.18) ≈ 0,75
  const key = new Map(codes.map((c) => [c, Math.abs((difficulty(c) ?? 0.5) - target) + r() * 0.12]));
  return [...codes].sort((a, b) => key.get(a)! - key.get(b)!);
}

export function sanitizeSkill(x: unknown): Skill | undefined {
  const s = x as Skill;
  return s && Number.isFinite(s.t) && Number.isFinite(s.n) ? { t: Math.min(1.2, Math.max(-0.2, s.t)), n: Math.max(0, Math.floor(s.n)) } : undefined;
}
