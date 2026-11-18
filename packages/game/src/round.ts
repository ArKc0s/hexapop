import { DEP, ITEM, dep, type Departement } from "./data.ts";
import { ATLASES, atlasOf, type AtlasId } from "./atlas.ts";
import { matchSet, normalize, sameCode, sameName } from "./answer.ts";
import { rng, shuffle, type Rng } from "./random.ts";

/**
 * Difficulté d'une partie. « decouverte » : indices nom ou carte seulement (jamais deux inconnues), propositions
 * faciles et carte à 4 départements surlignés. « normal » (Confirmé) : tous les indices. « expert » : + sous-préfectures et voisins.
 */
export type Level = "decouverte" | "normal" | "expert";
export type InputMode = "choix" | "libre";
/** Ce qu'on montre au joueur pour lancer le tour. */
export type Hint = "nom" | "numero" | "carte" | "prefecture" | "drapeau";
/** Ce que le joueur doit retrouver. */
export type Field = "carte" | "nom" | "numero" | "prefecture" | "drapeau" | "sousPrefectures" | "limitrophes";
/** Le drapeau se choisit toujours parmi 4 (on ne dessine pas un drapeau au clavier) : ses propositions sont des codes. */
export type ChoiceField = "nom" | "numero" | "prefecture" | "drapeau";

export interface Question {
  index: number;
  code: string;
  hint: Hint;
  fields: Field[];
  /** Durée du chrono ; 0 = sans chrono (entraînement solo). */
  durationMs: number;
  /** Propositions pour le mode choix multiples (absent en saisie libre). */
  choices?: Partial<Record<ChoiceField, string[]>>;
  /** Pour placer sur la carte en mode propositions : 4 départements surlignés, dont le bon. */
  mapChoices?: string[];
  /** Séance Continuer : département jamais vu (« devine »), celui d'où tu viens, ou une révision (hors de la région en cours). */
  tag?: "new" | "home" | "review" | "expert";
  /** Rappel de fin de séance : sauté si le département a déjà été réussi sans faute plus tôt dans la séance. */
  recall?: boolean;
  /** Propositions faciles (leurres lointains) : la bonne réponse ne compte que comme « vue ». */
  easy?: boolean;
}

/** Question imposée (séance composée) : département, indice, ce qu'on demande. */
export interface PlanItem { code: string; hint: Hint; ask: Field[]; tag?: "new" | "home" | "review" | "expert"; recall?: boolean; easy?: boolean }

export interface Answer {
  carte?: string;
  nom?: string;
  numero?: string;
  prefecture?: string;
  /** Code du pays dont on a choisi le drapeau. */
  drapeau?: string;
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
  /** Atlas joué (défaut : les départements). */
  atlas?: AtlasId;
  level: Level;
  input: InputMode;
  /** Codes des départements joués ; défaut : les 101. */
  codes?: string[];
  /** Nombre de tours ; défaut : tous les codes. */
  rounds?: number;
  hints?: Hint[];
  /** Ce que le joueur doit retrouver ; défaut : tout sauf l'indice (+ expert selon le niveau). */
  ask?: Field[];
  /** 0 = sans chrono. */
  durationMs?: number;
  /** Prépare toujours les propositions, pour basculer clavier / propositions en cours de partie. */
  switchable?: boolean;
  /** Séance composée : les questions dans cet ordre (remplace codes, rounds, hints, ask). */
  plan?: PlanItem[];
}

export const POINTS_PER_FIELD = 100;
export const DEFAULT_DURATION: Record<Level, number> = { decouverte: 20_000, normal: 20_000, expert: 60_000 };

/** Champs demandés pour un indice donné ; avec `ask`, seulement ceux-là (jamais l'indice lui-même). */
export function fieldsFor(d: Departement, hint: Hint, level: Level, ask?: Field[]): Field[] {
  if (ask) {
    return ask.filter((f) => f !== hint && (f !== "sousPrefectures" || d.sousPrefectures.length > 0) && (f !== "limitrophes" || d.limitrophes.length > 0) && (f !== "prefecture" || d.prefecture !== ""));
  }
  const base = atlasOf(d.code).full;
  const fields = base.filter((f) => f !== hint && (f !== "prefecture" || d.prefecture !== ""));
  if (level === "expert") {
    if (d.sousPrefectures.length) fields.push("sousPrefectures");
    if (d.limitrophes.length) fields.push("limitrophes");
  }
  return fields;
}

/** Leurres plausibles : voisins et même région d'abord, puis le reste. */
function distractors(d: Departement, r: Rng): Departement[] {
  const near = shuffle(d.limitrophes.map((c) => dep(c)), r);
  const all = atlasOf(d.code).items;
  const region = shuffle(all.filter((x) => x.region === d.region && x.code !== d.code && !d.limitrophes.includes(x.code)), r);
  const rest = shuffle(all.filter((x) => x.region !== d.region && x.code !== d.code && !d.limitrophes.includes(x.code)), r);
  return [...near.slice(0, 2), ...region.slice(0, 1), ...rest].slice(0, 3);
}

/** Leurres lointains (autres régions, pas de voisin) : pour la première rencontre. */
function easyDistractors(d: Departement, r: Rng): Departement[] {
  const all = atlasOf(d.code).items;
  const far = all.filter((x) => x.code !== d.code && x.region !== d.region && !d.limitrophes.includes(x.code) && x.outreMer === d.outreMer);
  // Petit atlas (régions) : pas assez de lointains, on complète avec les autres.
  const pool = far.length >= 3 ? far : all.filter((x) => x.code !== d.code && !d.limitrophes.includes(x.code));
  return shuffle(pool.length >= 3 ? pool : all.filter((x) => x.code !== d.code), r).slice(0, 3);
}

function makeChoices(d: Departement, fields: Field[], others: Departement[], r: Rng): Question["choices"] {
  const out: Question["choices"] = {};
  const pick = (f: ChoiceField, get: (x: Departement) => string) => {
    if (!fields.includes(f)) return;
    // Pas deux propositions trop proches (« Jérusalem » / « Jérusalem-Est ») : ce serait un piège, pas une question.
    // Seulement les capitales du Monde : les autres atlas gardent exactement leurs tirages (défi du jour, salons).
    const mine = normalize(get(d));
    const close = (x: string) => f === "prefecture" && atlasOf(d.code).id === "monde" && (normalize(x).includes(mine) || mine.includes(normalize(x)));
    out[f] = shuffle([get(d), ...others.map(get).filter((x) => x && !close(x))], r);
  };
  pick("nom", (x) => x.nom);
  pick("numero", (x) => x.code);
  pick("prefecture", (x) => x.prefecture);
  pick("drapeau", (x) => x.code);
  return out;
}

/** Une configuration est jouable si au moins un indice laisse quelque chose à trouver. */
export function playable(hints: Hint[], ask: Field[]): boolean {
  return hints.some((h) => ask.some((f) => f !== h));
}

/** Autres réponses acceptées pour la préfecture : la préfecture du Val-d'Oise est à Cergy (chef-lieu légal : Pontoise). */
export const PREFECTURE_ALIASES: Record<string, string[]> = { "95": ["Cergy", "Cergy-Pontoise"], "91": ["Évry"] };

export function makeGame(cfg: GameConfig): Question[] {
  const r = rng(cfg.seed);
  if (cfg.plan) {
    const duration = cfg.durationMs ?? 0;
    return cfg.plan.filter((it) => ITEM.has(it.code)).map((it, index) => {
      const d = dep(it.code);
      let fields = fieldsFor(d, it.hint, cfg.level, it.ask);
      if (!fields.length) fields = fieldsFor(d, it.hint, cfg.level, [...atlasOf(d.code).base] as Field[]);
      const q: Question = { index, code: it.code, hint: it.hint, fields, durationMs: duration };
      if (it.tag) q.tag = it.tag;
      if (it.recall) q.recall = true;
      if (it.easy) q.easy = true;
      const others = it.easy ? easyDistractors(d, r) : distractors(d, r);
      q.choices = makeChoices(d, fields, others, r);
      // Pas de carte à 4 départements surlignés en séance : on y joue région par région, les leurres trahiraient la réponse.
      return q;
    });
  }
  const atlas = ATLASES[cfg.atlas ?? "france"];
  const pool = cfg.codes ?? atlas.items.map((d) => d.code);
  const codes = shuffle(pool, r).slice(0, cfg.rounds ?? pool.length);
  // Découverte : on donne toujours quelque chose qu'on peut connaître (le nom, ou le département qui clignote).
  const easy = cfg.level === "decouverte";
  const known = (cfg.hints ?? ["nom", "carte"]).filter((h) => h === "nom" || h === "carte");
  const hints = easy ? (known.length ? known : ["nom", "carte"] as Hint[]) : cfg.hints ?? (atlas.id === "france" ? ["nom", "numero", "carte"] : atlas.hints.filter((h) => h !== "prefecture"));
  const duration = cfg.durationMs ?? DEFAULT_DURATION[cfg.level];
  return codes.map((code, index) => {
    const d = dep(code);
    // Indice tiré au hasard parmi ceux qui laissent quelque chose à trouver pour ce département.
    // Jamais la capitale en indice quand elle n'est pas demandée (statut contesté).
    const hintsOk = hints.filter((h) => h !== "prefecture" || d.prefecture !== "");
    const usable = cfg.ask ? hintsOk.filter((h) => fieldsFor(d, h, cfg.level, cfg.ask).length > 0) : hintsOk;
    const from = usable.length ? usable : hintsOk.length ? hintsOk : ["nom" as Hint];
    const hint = from[Math.floor(r() * from.length)];
    let fields = fieldsFor(d, hint, cfg.level, cfg.ask);
    if (!fields.length) fields = fieldsFor(d, hint, cfg.level);
    const q: Question = { index, code, hint, fields, durationMs: duration };
    if (easy) {
      // Propositions faciles (leurres lointains), y compris sur la carte : 4 départements surlignés.
      const others = easyDistractors(d, r);
      q.choices = makeChoices(d, fields, others, r);
      if (fields.includes("carte")) q.mapChoices = shuffle([d.code, ...others.map((x) => x.code)], r);
      q.easy = true;
    } else if (cfg.input === "choix" || cfg.switchable) {
      const others = distractors(d, r);
      q.choices = makeChoices(d, fields, others, r);
      // Réservé à l'entraînement : ne change pas les tirages du défi du jour ni des salons.
      if (cfg.switchable && fields.includes("carte")) q.mapChoices = shuffle([d.code, ...others.map((x) => x.code)], r);
    } else if (fields.includes("drapeau")) {
      // Au clavier aussi, le drapeau se choisit parmi 4 (Monde seulement : les autres tirages ne changent pas).
      q.choices = { drapeau: shuffle([d, ...distractors(d, r)].map((x) => x.code), r) };
    }
    return q;
  });
}

/** Version envoyée aux joueurs en multi : sans la réponse. */
export type PublicQuestion = Omit<Question, "code"> & { clue: string };

export function clueFor(q: Question): string {
  const d = dep(q.code);
  if (q.hint === "nom") return d.nom;
  if (q.hint === "numero") return d.code;
  if (q.hint === "prefecture") return d.prefecture;
  if (q.hint === "drapeau") return d.iso2 ?? "";
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
      case "nom": return { field, score: a.nom && [d.nom, ...(d.alias ?? [])].some((n) => sameName(a.nom!, n)) ? 1 : 0, expected: d.nom };
      case "numero": return { field, score: a.numero && sameCode(a.numero, d.code) ? 1 : 0, expected: d.code };
      case "prefecture": return { field, score: a.prefecture && [d.prefecture, ...(PREFECTURE_ALIASES[d.code] ?? []), ...(d.prefAlias ?? [])].some((p) => sameName(a.prefecture!, p)) ? 1 : 0, expected: d.prefecture };
      // Régions : « ses départements », par leur nom ou leur numéro.
      case "sousPrefectures": return { field, score: gradeList(d.code.startsWith("R") ? a.sousPrefectures?.map((x) => DEP.get(x.trim().toUpperCase().padStart(2, "0"))?.nom ?? x) : a.sousPrefectures, d.sousPrefectures, true), expected: d.sousPrefectures };
      case "drapeau": return { field, score: a.drapeau === d.code ? 1 : 0, expected: d.code };
      case "limitrophes": return { field, score: gradeList(a.limitrophes, d.limitrophes, false), expected: d.limitrophes };
    }
  });
  const timed = q.durationMs > 0;
  const elapsedMs = timed ? Math.min(Math.max(0, a.elapsedMs), q.durationMs) : Math.max(0, a.elapsedMs);
  const sum = fields.reduce((n, f) => n + f.score, 0);
  const accuracy = fields.length ? sum / fields.length : 0;
  // Bonus vitesse : jusqu'à ×2 si on répond instantanément, ×1 à la fin du chrono ; aucun sans chrono.
  const speed = timed ? 1 + (1 - elapsedMs / q.durationMs) : 1;
  const points = Math.round(sum * POINTS_PER_FIELD * speed);
  return { code: d.code, fields, accuracy, points, elapsedMs };
}

export { DEP };
