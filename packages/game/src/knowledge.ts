// Ce que le joueur sait vraiment : une fiche par département et par facette
// (carte, numéro, préfecture, puis en expert sous-préfectures et voisins).
// Voir docs/conception.md, sections 2 et 4.
import { DEPARTEMENTS, ITEM } from "./data.ts";
import { ATLASES, atlasOf, type AtlasId } from "./atlas.ts";
import type { Field, Hint, Level, RoundResult } from "./round.ts";
import { INTERVALS, type Progress } from "./srs.ts";

export type Facet = "carte" | "numero" | "prefecture" | "sousPrefectures" | "limitrophes";
export const BASE_FACETS: readonly Facet[] = ["carte", "numero", "prefecture"];
export const EXPERT_FACETS: readonly Facet[] = ["sousPrefectures", "limitrophes"];
export const FACETS: readonly Facet[] = [...BASE_FACETS, ...EXPERT_FACETS];
export const MAX_STARS = DEPARTEMENTS.length * BASE_FACETS.length; // 303
/** Étoiles possibles dans un atlas (départements : 303 ; régions : 36). */
export const maxStars = (a: AtlasId = "france") => ATLASES[a].items.length * ATLASES[a].base.length;
/** Facettes de base de l'élément de ce code (selon son atlas). */
export const baseFacetsOf = (code: string): readonly Facet[] => atlasOf(code).base;

/** Fiche d'une facette : boîte de Leitner, prochaine révision, étoile gagnée, déjà vue en propositions. */
export interface FacetCard { b: number; d: number; s: 0 | 1; v: 0 | 1 }
export type Knowledge = Record<string, Partial<Record<Facet, FacetCard>>>;

const DAY = 86_400_000;
/** Argent : les 3 étoiles revues avec succès à des jours d'écart (boîte 4 = intervalles 10 min, 1 j, 3 j franchis). */
export const ARGENT_BOX = 4;

export type Medal = 0 | 1 | 2 | 3;
export const MEDAL_NAMES = ["", "bronze", "argent", "or"] as const;

/** Facettes en jeu quand on donne `hint` et qu'on demande `field`. Le nom n'est pas une facette : c'est l'ancre. */
export function facetsOf(hint: Hint, field: Field): Facet[] {
  if (field === "nom") return hint === "nom" ? [] : [hint as Facet];
  const f = field as Facet;
  if (hint === "nom" || hint === field) return [f];
  // Deux facettes reliées sans passer par le nom (« place le 87 ») : réussir prouve les deux.
  return [f, hint as Facet];
}

function blank(): FacetCard { return { b: 0, d: 0, s: 0, v: 0 }; }

/** Une étoile pâlit quand sa révision est en retard d'au moins son propre intervalle (un jour minimum). */
export function cardFading(c: FacetCard | undefined, now: number): boolean {
  if (!c || !c.s) return false;
  return now - c.d > Math.max(DAY, INTERVALS[c.b] ?? DAY);
}

export interface RoundPlay { hint: Hint; fields: Field[]; /** Champs répondus avec de l'aide (propositions, carte à 4 choix). */ aided: Field[] }
export interface KnowledgeGain { stars: { code: string; facet: Facet }[]; medals: { code: string; medal: Medal }[] }

/**
 * Met à jour la connaissance après une partie.
 * Sans aide et juste : la facette monte d'une boîte et gagne son étoile. Avec aide et juste : elle est « vue ».
 * Faux : elle redescend (boîte 0 si complètement faux) et revient vite, mais une étoile gagnée ne se perd jamais.
 */
export function learn(prev: Knowledge, results: RoundResult[], rounds: RoundPlay[], now: number): { know: Knowledge; gain: KnowledgeGain } {
  const know: Knowledge = structuredClone(prev);
  const before = new Map<string, Medal>();
  const stars: KnowledgeGain["stars"] = [];
  results.forEach((r, i) => {
    const play = rounds[i];
    if (!play || !ITEM.has(r.code)) return;
    if (!before.has(r.code)) before.set(r.code, medalOf(know, r.code, now));
    const dep = (know[r.code] ??= {});
    for (const fr of r.fields) {
      const facets = facetsOf(play.hint, fr.field);
      const aided = play.aided.includes(fr.field);
      const perfect = fr.score >= 0.999;
      facets.forEach((f, k) => {
        // Liaison sans le nom ratée : on ne pénalise que la facette demandée.
        if (!perfect && k > 0) return;
        const c = { ...(dep[f] ?? blank()) };
        if (perfect && aided) {
          c.v = 1;
          if (!c.s) { c.b = Math.max(c.b, 1); c.d = now + INTERVALS[c.b]; }
        } else if (perfect) {
          // Leitner : on ne monte d'une boîte que si la révision était due. Sinon, rejouer le même département
          // plusieurs fois dans la journée suffirait pour l'argent, qui doit dire « retenu sur plusieurs jours ».
          if (!c.s || now >= c.d) {
            c.b = Math.min(c.b + 1, INTERVALS.length - 1);
            c.d = now + INTERVALS[c.b];
          }
          c.v = 1;
          if (!c.s) { c.s = 1; stars.push({ code: r.code, facet: f }); }
        } else {
          c.b = fr.score < 0.5 ? 0 : Math.max(0, c.b - 1);
          c.d = now + INTERVALS[c.b];
        }
        dep[f] = c;
      });
    }
  });
  const medals: KnowledgeGain["medals"] = [];
  for (const [code, m0] of before) { const m = medalOf(know, code, now); if (m > m0) medals.push({ code, medal: m }); }
  return { know, gain: { stars, medals } };
}

/** Facettes expert qui existent pour ce département (pas de voisins pour une île, pas de sous-préfecture à Paris). */
export function expertFacetsOf(code: string): Facet[] {
  const d = ITEM.get(code);
  if (!d) return [];
  return atlasOf(code).expert.filter((f) => (f === "sousPrefectures" ? d.sousPrefectures.length > 0 : d.limitrophes.length > 0));
}

export function starsOf(k: Knowledge, code: string): number {
  return baseFacetsOf(code).filter((f) => k[code]?.[f]?.s).length;
}

/** Bronze : les 3 étoiles. Argent : retenues dans la durée. Or : argent + le niveau expert du département. */
export function medalOf(k: Knowledge, code: string, _now = 0): Medal {
  const dep = k[code];
  const base = baseFacetsOf(code);
  if (!dep || starsOf(k, code) < base.length) return 0;
  if (!base.every((f) => (dep[f]?.b ?? 0) >= ARGENT_BOX)) return 1;
  return expertFacetsOf(code).every((f) => dep[f]?.s) ? 3 : 2;
}

/** Médaille ternie : une de ses étoiles pâlit (elle revient en priorité dans les séances). */
export function tarnished(k: Knowledge, code: string, now: number): boolean {
  return baseFacetsOf(code).some((f) => cardFading(k[code]?.[f], now));
}

/** Départements dont au moins une étoile pâlit. */
export function fadingCodes(k: Knowledge, now: number, a: AtlasId = "france"): string[] {
  return ATLASES[a].items.map((d) => d.code).filter((c) => tarnished(k, c, now));
}

export function knownStars(k: Knowledge, a: AtlasId = "france"): number {
  return ATLASES[a].items.reduce((n, d) => n + starsOf(k, d.code), 0);
}

/** « Ta France » (ou l'avancée dans un autre atlas) : étoiles gagnées sur le total, en pourcentage entier. */
export function taFrance(k: Knowledge, a: AtlasId = "france"): number {
  return Math.floor((knownStars(k, a) / maxStars(a)) * 100);
}

export type PlayerLevel = "decouverte" | "confirme" | "expert";
export const PLAYER_LEVELS: Record<PlayerLevel, { nom: string; min: number }> = {
  decouverte: { nom: "Découverte", min: 0 },
  confirme: { nom: "Confirmé", min: 50 },
  expert: { nom: "Expert", min: 90 },
};
/** Difficulté de jeu (défi, salons) correspondant à un niveau de joueur. */
export const LEVEL_OF: Record<PlayerLevel, Level> = { decouverte: "decouverte", confirme: "normal", expert: "expert" };
/** Nom affiché d'une difficulté de jeu. */
export const LEVEL_NAMES: Record<Level, string> = { decouverte: "Découverte", normal: "Confirmé", expert: "Expert" };
export const LEVELS: readonly Level[] = ["decouverte", "normal", "expert"];
/** Le joueur peut jouer à son niveau ou en dessous, jamais au-dessus (conception 4.3). */
export const levelAllowed = (wanted: Level, max: Level) => LEVELS.indexOf(wanted) <= LEVELS.indexOf(max);
export const isLevel = (v: unknown): v is Level => v === "decouverte" || v === "normal" || v === "expert";
export function playerLevel(k: Knowledge, a: AtlasId = "france"): PlayerLevel {
  const pct = taFrance(k, a);
  return pct >= 90 ? "expert" : pct >= 50 ? "confirme" : "decouverte";
}

/** Titres : habillage plus fin de « Ta France ». */
export const TITLES = [
  { min: 0, name: "Touriste" },
  { min: 30, name: "Routard" },
  { min: 90, name: "Facteur" },
  { min: 165, name: "Sous-préfet" },
  { min: 240, name: "Préfet" },
  { min: MAX_STARS, name: "Géomètre de l'IGN" },
];
export function titleFor(k: Knowledge, a: AtlasId = "france"): { name: string; next: string | null; toNext: number } {
  const n = knownStars(k, a);
  // Autres atlas : mêmes titres, à la même proportion du total.
  const scale = maxStars(a) / MAX_STARS;
  const min = (i: number) => Math.round(TITLES[i].min * scale);
  let i = 0;
  while (i + 1 < TITLES.length && n >= min(i + 1)) i++;
  const next = TITLES[i + 1];
  return { name: TITLES[i].name, next: next?.name ?? null, toNext: next ? min(i + 1) - n : 0 };
}

export function medalCounts(k: Knowledge, a: AtlasId = "france"): [number, number, number, number] {
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (const d of ATLASES[a].items) out[medalOf(k, d.code)]++;
  return out;
}

/**
 * Reprise des anciens profils : personne ne perd ce qu'il a gagné.
 * Département maîtrisé en révision (boîte ≥ 4) ou vignette argent / or → ses 3 étoiles (médaille de bronze, à refaire monter).
 * Vu en révision ou vignette bronze → facettes « vues ».
 */
export function migrateKnowledge(progress: Progress, tiers: Record<string, number>, now: number): Knowledge {
  const know: Knowledge = {};
  for (const d of DEPARTEMENTS) {
    const old = progress[d.code];
    const tier = tiers[d.code] ?? 0;
    const mastered = (old?.box ?? 0) >= 4 || tier >= 2;
    const seen = !!old || tier >= 1;
    if (!mastered && !seen) continue;
    const dep: Partial<Record<Facet, FacetCard>> = {};
    for (const f of BASE_FACETS) {
      dep[f] = mastered
        ? { b: Math.min(Math.max(old?.box ?? 2, 2), ARGENT_BOX - 1), d: old?.due ?? now, s: 1, v: 1 }
        : { b: 0, d: old?.due ?? now, s: 0, v: 1 };
    }
    if (tier >= 3) for (const f of expertFacetsOf(d.code)) dep[f] = { b: 2, d: now, s: 1, v: 1 };
    know[d.code] = dep;
  }
  return know;
}

/** Fusion de deux appareils : étoile et « vu » cumulés, boîte et échéance de la révision la plus récente. */
export function mergeKnowledge(a: Knowledge, b: Knowledge): Knowledge {
  const out: Knowledge = {};
  for (const code of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!ITEM.has(code)) continue;
    const dep: Partial<Record<Facet, FacetCard>> = {};
    for (const f of FACETS) {
      const x = a[code]?.[f], y = b[code]?.[f];
      if (!x && !y) continue;
      const recent = !x ? y! : !y ? x : x.d >= y.d ? x : y;
      dep[f] = { b: recent.b, d: recent.d, s: (x?.s || y?.s ? 1 : 0), v: (x?.v || y?.v ? 1 : 0) };
    }
    out[code] = dep;
  }
  return out;
}

/** Nettoyage d'une connaissance reçue (stockage local corrompu ou client malveillant). */
export function sanitizeKnowledge(raw: unknown): Knowledge | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Knowledge = {};
  for (const [code, dep] of Object.entries(raw as Record<string, unknown>)) {
    if (!ITEM.has(code) || !dep || typeof dep !== "object") continue;
    const clean: Partial<Record<Facet, FacetCard>> = {};
    for (const f of FACETS) {
      const c = (dep as Record<string, unknown>)[f] as Partial<FacetCard> | undefined;
      if (!c || typeof c !== "object") continue;
      const b = Number(c.b), d = Number(c.d);
      clean[f] = {
        b: Number.isFinite(b) ? Math.max(0, Math.min(INTERVALS.length - 1, Math.floor(b))) : 0,
        d: Number.isFinite(d) ? Math.max(0, Math.min(8.64e15, d)) : 0,
        s: c.s ? 1 : 0, v: c.v ? 1 : 0,
      };
    }
    out[code] = clean;
  }
  return out;
}
