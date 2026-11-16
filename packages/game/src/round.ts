import { DEPARTEMENTS, DEP, dep, type Departement } from "./data.ts";
import { matchSet, sameCode, sameName } from "./answer.ts";
import { rng, shuffle, type Rng } from "./random.ts";

export type Level = "normal" | "expert";
export type InputMode = "choix" | "libre";
/** Ce qu'on montre au joueur pour lancer le tour. */
export type Hint = "nom" | "numero" | "carte";
/** Ce que le joueur doit retrouver. */
export type Field = "carte" | "nom" | "numero" | "prefecture" | "sousPrefectures" | "limitrophes";
export type ChoiceField = "nom" | "numero" | "prefecture";

export interface Question {
  index: number;
  code: string;
  hint: Hint;
  fields: Field[];
  durationMs: number;
  /** Propositions pour le mode choix multiples (absent en saisie libre). */
  choices?: Partial<Record<ChoiceField, string[]>>;
}

export interface Answer {
  carte?: string;
  nom?: string;
  numero?: string;
  prefecture?: string;
  sousPrefectures?: string[];
  limitrophes?: string[];
  elapsedMs: number;
}

export interface FieldResult {
  field: Field;
  /** 0 à 1 (partiel pour les listes). */
  score: number;
  expected: string | string[];
}

export interface RoundResult {
  code: string;
  fields: FieldResult[];
  /** Somme des scores de champ / nombre de champs, 0 à 1. */
  accuracy: number;
  points: number;
  elapsedMs: number;
}

export interface GameConfig {
  seed: number;
  level: Level;
  input: InputMode;
  /** Codes des départements joués ; défaut : les 101. */
  codes?: string[];
  /** Nombre de tours ; défaut : tous les codes. */
  rounds?: number;
  hints?: Hint[];
  durationMs?: number;
}

export const POINTS_PER_FIELD = 100;
export const DEFAULT_DURATION: Record<Level, number> = { normal: 20_000, expert: 60_000 };

export function fieldsFor(d: Departement, hint: Hint, level: Level): Field[] {
  const base: Field[] = ["carte", "nom", "numero", "prefecture"];
  const fields = base.filter((f) => f !== hint);
  if (level === "expert") {
    if (d.sousPrefectures.length) fields.push("sousPrefectures");
    if (d.limitrophes.length) fields.push("limitrophes");
  }
  return fields;
}

/** Leurres plausibles : voisins et même région d'abord, puis le reste. */
function distractors(d: Departement, r: Rng): Departement[] {
  const near = shuffle(d.limitrophes.map((c) => dep(c)), r);
  const region = shuffle(DEPARTEMENTS.filter((x) => x.region === d.region && x.code !== d.code && !d.limitrophes.includes(x.code)), r);
  const rest = shuffle(DEPARTEMENTS.filter((x) => x.region !== d.region && x.code !== d.code && !d.limitrophes.includes(x.code)), r);
  return [...near.slice(0, 2), ...region.slice(0, 1), ...rest].slice(0, 3);
}

function makeChoices(d: Departement, fields: Field[], r: Rng): Question["choices"] {
  const others = distractors(d, r);
  const out: Question["choices"] = {};
  const pick = (f: ChoiceField, get: (x: Departement) => string) => {
    if (fields.includes(f)) out[f] = shuffle([d, ...others].map(get), r);
  };
  pick("nom", (x) => x.nom);
  pick("numero", (x) => x.code);
  pick("prefecture", (x) => x.prefecture);
  return out;
}

export function makeGame(cfg: GameConfig): Question[] {
  const r = rng(cfg.seed);
  const pool = cfg.codes ?? DEPARTEMENTS.map((d) => d.code);
  const codes = shuffle(pool, r).slice(0, cfg.rounds ?? pool.length);
  const hints = cfg.hints ?? ["nom", "numero", "carte"];
  const duration = cfg.durationMs ?? DEFAULT_DURATION[cfg.level];
  return codes.map((code, index) => {
    const d = dep(code);
    const hint = hints[Math.floor(r() * hints.length)];
    const fields = fieldsFor(d, hint, cfg.level);
    const q: Question = { index, code, hint, fields, durationMs: duration };
    if (cfg.input === "choix") q.choices = makeChoices(d, fields, r);
    return q;
  });
}

/** Version envoyée aux joueurs en multi : sans la réponse. */
export type PublicQuestion = Omit<Question, "code"> & { clue: string };

export function clueFor(q: Question): string {
  const d = dep(q.code);
  if (q.hint === "nom") return d.nom;
  if (q.hint === "numero") return d.code;
  return d.code; // indice carte : le client surligne ce département
}

function gradeList(given: string[] | undefined, expected: string[], byName: boolean): number {
  if (!expected.length) return 1;
  const g = given ?? [];
  if (byName) {
    const { found, wrong } = matchSet(g, expected);
    return Math.max(0, (found.length - wrong.length * 0.5) / expected.length);
  }
  const set = new Set(g);
  const found = expected.filter((c) => set.has(c)).length;
  const wrong = [...set].filter((c) => !expected.includes(c)).length;
  return Math.max(0, (found - wrong * 0.5) / expected.length);
}

export function grade(q: Question, a: Answer): RoundResult {
  const d = dep(q.code);
  const fields: FieldResult[] = q.fields.map((field) => {
    switch (field) {
      case "carte": return { field, score: a.carte === d.code ? 1 : 0, expected: d.code };
      case "nom": return { field, score: a.nom && sameName(a.nom, d.nom) ? 1 : 0, expected: d.nom };
      case "numero": return { field, score: a.numero && sameCode(a.numero, d.code) ? 1 : 0, expected: d.code };
      case "prefecture": return { field, score: a.prefecture && sameName(a.prefecture, d.prefecture) ? 1 : 0, expected: d.prefecture };
      case "sousPrefectures": return { field, score: gradeList(a.sousPrefectures, d.sousPrefectures, true), expected: d.sousPrefectures };
      case "limitrophes": return { field, score: gradeList(a.limitrophes, d.limitrophes, false), expected: d.limitrophes };
    }
  });
  const elapsedMs = Math.min(Math.max(0, a.elapsedMs), q.durationMs);
  const sum = fields.reduce((n, f) => n + f.score, 0);
  const accuracy = fields.length ? sum / fields.length : 0;
  // Bonus vitesse : jusqu'à ×2 si on répond instantanément, ×1 à la fin du chrono.
  const speed = 1 + (1 - elapsedMs / q.durationMs);
  const points = Math.round(sum * POINTS_PER_FIELD * speed);
  return { code: d.code, fields, accuracy, points, elapsedMs };
}

export { DEP };
