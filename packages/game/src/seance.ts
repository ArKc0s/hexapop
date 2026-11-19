// « Continuer » : le jeu compose la séance à la place du joueur (docs/conception.md, section 5).
// D'abord ce qui est à revoir, puis la découverte de la région en cours, puis la consolidation.
import { ATLASES, inAtlas, R_METRO, type AtlasId } from "./atlas.ts";
import { EXPERT_FACETS, FACETS, baseFacetsOf, expertFacetsOf, medalOf, type Facet, type Knowledge } from "./knowledge.ts";
import { OUTRE_MER, TOUR, groupsOf, type TourRegion } from "./meta.ts";
import { rng, shuffle } from "./random.ts";
import { ITEM } from "./data.ts";
import type { Field, Hint, PlanItem } from "./round.ts";

export const SEANCE_SIZE = 12;
/** Région de départ quand le joueur n'a pas dit d'où il vient : peu de départements, formes faciles. */
export const DEFAULT_START = "53";

const seen = (k: Knowledge, code: string, f: Facet) => !!(k[code]?.[f]?.v || k[code]?.[f]?.s);
const starred = (k: Knowledge, code: string, f: Facet) => !!k[code]?.[f]?.s;
/** Département (ou élément d'un autre atlas) pas encore « fini » : une de ses étoiles de base manque. */
const unfinished = (k: Knowledge, code: string) => baseFacetsOf(code).some((f) => !starred(k, code, f));
/** Facettes expert pas encore étoilées (sous-préfectures, voisins), quand le département en a. */
const expertTodo = (k: Knowledge, code: string) => expertFacetsOf(code).filter((f) => !starred(k, code, f));
/** L'expert d'une région s'ouvre quand toutes ses étoiles de base sont gagnées (conception 4.4). */
export const expertOpen = (k: Knowledge, r: TourRegion) => r.deps.every((c) => !unfinished(k, c));
/** Région à l'expert ouvert mais pas encore toute en or. */
export const expertPending = (k: Knowledge, r: TourRegion) => expertOpen(k, r) && r.deps.some((c) => expertTodo(k, c).length > 0);

/** Ordre de découverte des régions : la région de départ, puis ses voisines de proche en proche ; l'outre-mer à la fin. */
export function regionOrder(start: string, atlas: AtlasId = "france"): TourRegion[] {
  // Autres atlas : leurs groupes dans l'ordre (régions : la métropole, puis l'outre-mer).
  if (atlas !== "france") return groupsOf(atlas);
  // Un joueur d'outre-mer commence par l'outre-mer, puis la métropole.
  if (start === OUTRE_MER) return [TOUR.get(OUTRE_MER)!, ...regionOrder(DEFAULT_START).filter((r) => r.code !== OUTRE_MER)];
  const first = TOUR.has(start) ? start : DEFAULT_START;
  const order: string[] = [first];
  for (let i = 0; i < order.length; i++) {
    for (const n of TOUR.get(order[i])!.neighbors) if (!order.includes(n) && n !== OUTRE_MER) order.push(n);
  }
  for (const r of groupsOf("france")) if (!order.includes(r.code)) order.push(r.code);
  return order.map((c) => TOUR.get(c)!);
}

/** Région en cours : celle choisie par le joueur, sinon la première, dans l'ordre de découverte, qui n'est pas finie. */
export function currentRegion(k: Knowledge, start: string, focus?: string | null, atlas: AtlasId = "france"): TourRegion | null {
  const groups = groupsOf(atlas);
  if (focus && groups.some((g) => g.code === focus) && TOUR.get(focus)!.deps.some((c) => unfinished(k, c))) return TOUR.get(focus)!;
  return regionOrder(start, atlas).find((r) => r.deps.some((c) => unfinished(k, c))) ?? null;
}

export interface SeanceOpts { now: number; seed: number; start: string; /** Atlas joué (défaut : départements). */ atlas?: AtlasId; focus?: string | null; home?: string | null; size?: number; /** Forcer une séance de révisions. */ kind?: SeanceKind }
export type SeanceKind = "region" | "revision";
export interface Seance {
  kind: SeanceKind; plan: PlanItem[]; region: TourRegion | null; reviews: number; discover: string[];
  /** Séance expert : la région a toutes ses étoiles de base, on travaille sous-préfectures et voisins. */
  expert: boolean;
  /** Départements travaillés en expert dans cette séance. */
  experts: string[];
  /** Une région à l'expert ouvert, proposée à côté (« Passer en expert ») quand la séance est ailleurs. */
  expertRegion: TourRegion | null;
  /** Révisions dues hors de la région de la séance : proposées à part, jamais glissées dedans. */
  elsewhere: number;
}
/** Révisions dues ailleurs à partir desquelles « Continuer » propose une séance de révisions plutôt que la région. */
export const REVISION_MIN = 3;

/** Départements dont une étoile est à revoir, les plus en retard d'abord. */
/**
 * Les plus en retard d'abord, à la journée près ; au sein d'une même journée, au hasard. (Trié à la milliseconde, les
 * départements révisés ensemble revenaient dans l'ordre de la séance précédente, et les ex aequo dans l'ordre des
 * numéros : « 74, 75, 76, 78, 80… », remarque de Léo.)
 */
function dueOf(k: Knowledge, now: number, atlas: AtlasId, r: () => number) {
  const DAY_MS = 86_400_000;
  return shuffle(Object.entries(k)
    .map(([code, dep]) => ({ code, facets: FACETS.filter((f) => dep[f]?.s && dep[f]!.d <= now), late: Math.min(...FACETS.map((f) => (dep[f]?.s ? dep[f]!.d : Infinity))) }))
    .filter((x) => x.facets.length && inAtlas(atlas, x.code)), r)
    .sort((a, b) => Math.floor(a.late / DAY_MS) - Math.floor(b.late / DAY_MS));
}

/**
 * Compose une séance de 12 questions au plus, toujours sur un seul thème, celui qu'on annonce :
 * - séance de région : uniquement des départements de cette région (ses révisions, la suite, la découverte, la consolidation) ;
 * - séance de révisions : les départements à revoir, partout en France.
 * Une région choisie sur la carte est toujours respectée. Sinon, des révisions accumulées ailleurs passent avant la région.
 */
export function composeSeance(k: Knowledge, o: SeanceOpts): Seance {
  const r = rng(o.seed);
  const size = o.size ?? SEANCE_SIZE;
  const plan: PlanItem[] = [];
  const used = new Set<string>();
  const add = (it: PlanItem) => { plan.push(it); used.add(it.code); };
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const atlas = o.atlas ?? "france";
  const A = ATLASES[atlas];
  const BASE = A.base as Field[];
  // Indices d'une fiche complète : le nom ou la carte (Monde : ou le drapeau).
  const FULL_HINTS: Hint[] = atlas === "monde" ? ["nom", "carte", "drapeau"] : ["nom", "carte"];
  const full = (c: string): PlanItem => ({ code: c, hint: pick<Hint>(FULL_HINTS), ask: [...A.full] });
  const review = (x: { code: string; facets: Facet[] }): PlanItem => {
    const base = x.facets.filter((f) => A.base.includes(f));
    const exp = x.facets.filter((f) => EXPERT_FACETS.includes(f)) as Field[];
    if (base.length >= 2) { const it = full(x.code); return { ...it, ask: [...it.ask, ...exp], tag: "review" }; }
    if (!base.length) return { code: x.code, hint: "nom", ask: exp, tag: "review" };
    // Une seule facette : dans un sens ou dans l'autre (« le numéro du Finistère » / « le 29, c'est ? »).
    const f = base[0] as Hint & Field;
    if (exp.length) return { code: x.code, hint: "nom", ask: [f, ...exp], tag: "review" };
    return r() < 0.5 ? { code: x.code, hint: "nom", ask: [f], tag: "review" } : { code: x.code, hint: f, ask: ["nom"], tag: "review" };
  };
  /** Consolidation (fiche complète), les moins solides d'abord. Jamais deux inconnues : le numéro ne sert d'indice que s'il est connu. */
  const consolidate = (codes: string[], n: number) => {
    // Les moins solides d'abord ; à égalité, au hasard (sinon l'ordre des numéros : « 89, 90, 91… »), puis mélangés.
    const known = shuffle(codes.filter((c) => inAtlas(atlas, c) && !used.has(c) && A.base.some((f) => starred(k, c, f))), r)
      .sort((a, b) => medalOf(k, a) - medalOf(k, b) || (k[a].carte?.b ?? 0) - (k[b].carte?.b ?? 0));
    for (const c of shuffle(known.slice(0, Math.max(0, n)), r)) add({ code: c, hint: pick<Hint>(atlas === "france" && starred(k, c, "numero") ? ["nom", "carte", "numero"] : atlas === "monde" && starred(k, c, "drapeau") ? FULL_HINTS : ["nom", "carte"]), ask: [...A.full], tag: "review" });
  };

  const due = dueOf(k, o.now, atlas, r);
  const groups = groupsOf(atlas);
  const focus = o.focus && groups.some((g) => g.code === o.focus) ? TOUR.get(o.focus)! : null;
  const start = atlas === "france" ? o.start : R_METRO;
  const order = regionOrder(start, atlas);
  // La région choisie, sinon la suivante à découvrir ; tout découvert : la première dont l'expert n'est pas fini.
  const region = focus ?? currentRegion(k, start, null, atlas) ?? order.find((x) => expertPending(k, x)) ?? null;
  const expert = !!region && expertOpen(k, region);
  // Quand la séance est ailleurs, une région à l'expert ouvert est proposée à côté (jamais glissée dedans).
  const expertRegion = expert ? null : order.find((x) => expertPending(k, x)) ?? null;
  const inRegion = (c: string) => !!region?.deps.includes(c);
  const elsewhere = due.filter((x) => !inRegion(x.code));

  // Séance de révisions : demandée, ou des révisions accumulées ailleurs (sauf si le joueur a choisi sa région), ou plus rien à travailler.
  if (o.kind === "revision" || !region || (!focus && elsewhere.length >= REVISION_MIN)) {
    for (const x of shuffle(due.slice(0, size), r)) add(review(x));
    const reviews = plan.length;
    if (plan.length < size && o.kind !== "revision" && !region) consolidate(Object.keys(k).filter((c) => inAtlas(atlas, c)), size - plan.length);
    return { kind: "revision", plan, region: null, reviews, discover: [], elsewhere: 0, expert: false, experts: [], expertRegion };
  }

  // Séance de région. 1. Ses révisions échues (la moitié de la séance au plus).
  for (const x of shuffle(due.filter((x) => inRegion(x.code)).slice(0, Math.ceil(size / 2)), r)) add(review(x));
  const reviews = plan.length;
  const discover: string[] = [];
  const experts: string[] = [];
  const recall: PlanItem[] = [];
  const room = () => size - plan.length - recall.length;

  if (expert) {
    // 2 bis. Région finie en base : ses sous-préfectures et ses voisins, une question par département
    // (si tu sais, c'est l'étoile ; sinon la correction t'apprend, et il revient une fois en fin de séance).
    const todo = shuffle(region.deps.filter((c) => expertTodo(k, c).length && !used.has(c)), r);
    const n = Math.min(todo.length, reviews ? 3 : 4, Math.floor(room() / 2));
    for (const c of todo.slice(0, n)) {
      const ask = expertTodo(k, c) as Field[];
      add({ code: c, hint: "nom", ask, tag: "expert" });
      experts.push(c);
      recall.push({ code: c, hint: "nom", ask, recall: true });
    }
  } else {
    // 2. On fait avancer les départements commencés, puis on en découvre de nouveaux.
    const deps = shuffle(region.deps.filter((c) => unfinished(k, c) && !used.has(c)), r);
    const started = deps.filter((c) => A.base.some((f) => seen(k, c, f)));
    let fresh = deps.filter((c) => !started.includes(c));
    // Monde : les pays connus d'abord (la France avant le Vatican), avec un peu de hasard entre voisins de notoriété.
    if (atlas === "monde") {
      const key = new Map(fresh.map((c) => [c, (ITEM.get(c)?.rang ?? 100) + r() * 25]));
      fresh = fresh.sort((a, b) => key.get(a)! - key.get(b)!);
    }
    // Départements commencés : ce qui reste à trouver, ou la fiche complète si tout a été vu.
    const steps: PlanItem[] = [];
    for (const c of started) {
      const unseen = baseFacetsOf(c).filter((f) => !seen(k, c, f)) as Field[];
      steps.push(unseen.length ? { code: c, hint: "nom", ask: unseen } : full(c));
    }
    for (const it of steps.slice(0, Math.max(0, room() - 3))) add(it);
    // Chez toi : tu le connais sûrement, demandé d'emblée. S'il est su, ce sont 3 étoiles tout de suite.
    if (o.home && fresh.includes(o.home) && room() >= 3) {
      add({ code: o.home, hint: "nom", ask: [...BASE], tag: "home" });
      fresh = fresh.filter((c) => c !== o.home);
    }
    // Découverte : rien n'est montré avant. Une question complète par département (« devine ! ») : si tu sais, c'est fini,
    // 3 étoiles d'un coup. Sinon la correction t'apprend, et il revient une fois en fin de séance (rappel).
    const nNew = Math.min(fresh.length, reviews ? 3 : 4, Math.floor(room() / 2));
    const news = fresh.slice(0, nNew);
    for (const c of news) add({ code: c, hint: "nom", ask: [...BASE], tag: "new" });
    discover.push(...news);
    recall.push(...news.map((c): PlanItem => ({ code: c, hint: "nom", ask: [...BASE], recall: true })));
    for (const it of steps) if (room() > 0 && !used.has(it.code)) add(it);
  }

  // 3. S'il reste de la place : consolidation des départements déjà connus de la région.
  consolidate(region.deps, room());
  return { kind: "region", plan: [...plan.slice(0, size - recall.length), ...recall], region, reviews, discover, elsewhere: elsewhere.length, expert, experts, expertRegion };
}
