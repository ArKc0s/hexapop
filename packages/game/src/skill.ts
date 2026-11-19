// Niveau du joueur par atlas, appris de ses réponses (à la façon d'un classement Elo) : chaque réponse le fait
// monter ou descendre selon qu'elle était attendue ou non. Il bouge vite au début (quelques réponses suffisent à
// passer des pays célèbres aux pays moins connus), puis se stabilise. Les découvertes sont choisies là où le joueur
// réussit environ 3 fois sur 4 : ni trop facile, ni décourageant.
import { ITEM } from "./data.ts";

export interface Skill { /** Niveau, de 0 (débutant) à 1 (tout connaître). */ t: number; /** Réponses prises en compte. */ n: number }
export const NEW_SKILL: Skill = { t: 0.25, n: 0 };

/** Difficulté a priori (0 facile à 1 difficile) : la notoriété du pays ; undefined si on n'en sait rien (départements). */
export function difficulty(code: string): number | undefined {
  const rang = ITEM.get(code)?.rang;
  return rang === undefined ? undefined : Math.min(1, Math.max(0, (rang - 22) / 96));
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
