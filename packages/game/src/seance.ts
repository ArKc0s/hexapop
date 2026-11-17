// « Continuer » : le jeu compose la séance à la place du joueur (docs/conception.md, section 5).
// D'abord ce qui est à revoir, puis la découverte de la région en cours, puis la consolidation.
import { DEP } from "./data.ts";
import { BASE_FACETS, medalOf, type Facet, type Knowledge } from "./knowledge.ts";
import { OUTRE_MER, TOUR, TOUR_REGIONS, type TourRegion } from "./meta.ts";
import { rng, shuffle } from "./random.ts";
import type { Field, Hint, PlanItem } from "./round.ts";

export const SEANCE_SIZE = 12;
/** Région de départ quand le joueur n'a pas dit d'où il vient : peu de départements, formes faciles. */
export const DEFAULT_START = "53";

const seen = (k: Knowledge, code: string, f: Facet) => !!(k[code]?.[f]?.v || k[code]?.[f]?.s);
const starred = (k: Knowledge, code: string, f: Facet) => !!k[code]?.[f]?.s;
/** Département pas encore « fini » : une de ses 3 étoiles manque. */
const unfinished = (k: Knowledge, code: string) => BASE_FACETS.some((f) => !starred(k, code, f));

/** Ordre de découverte des régions : la région de départ, puis ses voisines de proche en proche ; l'outre-mer à la fin. */
export function regionOrder(start: string): TourRegion[] {
  // Un joueur d'outre-mer commence par l'outre-mer, puis la métropole.
  if (start === OUTRE_MER) return [TOUR.get(OUTRE_MER)!, ...regionOrder(DEFAULT_START).filter((r) => r.code !== OUTRE_MER)];
  const first = TOUR.has(start) ? start : DEFAULT_START;
  const order: string[] = [first];
  for (let i = 0; i < order.length; i++) {
    for (const n of TOUR.get(order[i])!.neighbors) if (!order.includes(n) && n !== OUTRE_MER) order.push(n);
  }
  for (const r of TOUR_REGIONS) if (!order.includes(r.code)) order.push(r.code);
  return order.map((c) => TOUR.get(c)!);
}

/** Région en cours : celle choisie par le joueur, sinon la première, dans l'ordre de découverte, qui n'est pas finie. */
export function currentRegion(k: Knowledge, start: string, focus?: string | null): TourRegion | null {
  if (focus && TOUR.has(focus) && TOUR.get(focus)!.deps.some((c) => unfinished(k, c))) return TOUR.get(focus)!;
  return regionOrder(start).find((r) => r.deps.some((c) => unfinished(k, c))) ?? null;
}

export interface SeanceOpts { now: number; seed: number; start: string; focus?: string | null; home?: string | null; size?: number }
export interface Seance { plan: PlanItem[]; region: TourRegion | null; reviews: number; discover: string[] }

/** Compose une séance de 12 questions au plus. */
export function composeSeance(k: Knowledge, o: SeanceOpts): Seance {
  const r = rng(o.seed);
  const size = o.size ?? SEANCE_SIZE;
  const plan: PlanItem[] = [];
  const used = new Set<string>();
  const add = (it: PlanItem) => { plan.push(it); used.add(it.code); };
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];

  // 1. À revoir : étoiles dont la révision est échue, les plus en retard d'abord (la moitié de la séance au plus).
  const due = Object.entries(k)
    .map(([code, dep]) => ({ code, facets: BASE_FACETS.filter((f) => dep[f]?.s && dep[f]!.d <= o.now), late: Math.min(...BASE_FACETS.map((f) => (dep[f]?.s ? dep[f]!.d : Infinity))) }))
    .filter((x) => x.facets.length && DEP.has(x.code))
    .sort((a, b) => a.late - b.late);
  for (const x of due.slice(0, Math.ceil(size / 2))) {
    if (x.facets.length >= 2) add({ code: x.code, hint: pick<Hint>(["nom", "carte"]), ask: ["carte", "nom", "numero", "prefecture"] });
    else {
      // Une seule facette : dans un sens ou dans l'autre (« le numéro du Finistère » / « le 29, c'est ? »).
      const f = x.facets[0] as Hint & Field;
      add(r() < 0.5 ? { code: x.code, hint: "nom", ask: [f] } : { code: x.code, hint: f, ask: ["nom"] });
    }
  }
  const reviews = plan.length;

  // 2. Région en cours : on fait avancer les départements commencés, puis on en découvre de nouveaux.
  const region = currentRegion(k, o.start, o.focus);
  const discover: string[] = [];
  const recall: PlanItem[] = [];
  if (region) {
    const deps = shuffle(region.deps.filter((c) => unfinished(k, c) && !used.has(c)), r);
    const started = deps.filter((c) => BASE_FACETS.some((f) => seen(k, c, f)));
    let fresh = deps.filter((c) => !started.includes(c));
    const room = () => size - plan.length - recall.length;
    // Départements commencés : fiche complète si les 3 facettes ont été vues, sinon ce qui reste à voir.
    const steps: PlanItem[] = [];
    for (const c of started) {
      const unseen = BASE_FACETS.filter((f) => !seen(k, c, f)) as Field[];
      if (!unseen.length) steps.push({ code: c, hint: pick<Hint>(["nom", "carte"]), ask: ["carte", "nom", "numero", "prefecture"] });
      else steps.push({ code: c, hint: "nom", ask: unseen, easy: true });
    }
    for (const it of steps.slice(0, Math.max(0, room() - 3))) add(it);
    // Chez toi : tu le connais sûrement. Demandé d'emblée, sans aide facile : s'il est su, ce sont 3 étoiles tout de suite.
    if (o.home && fresh.includes(o.home) && room() >= 4) {
      add({ code: o.home, hint: "nom", ask: ["carte", "numero", "prefecture"], tag: "home" });
      fresh = fresh.filter((c) => c !== o.home);
    }
    // Découverte : rien n'est montré avant. On devine avec des leurres lointains, la correction apprend
    // (deviner avant de voir aide à retenir). D'abord la carte, puis numéro et préfecture ensemble,
    // et un rappel en fin de séance, sans aide facile : c'est lui qui donne les premières étoiles.
    const nNew = Math.min(fresh.length, reviews ? 2 : 3, Math.floor(room() / 3));
    const news = fresh.slice(0, nNew);
    for (const c of news) add({ code: c, hint: "nom", ask: ["carte"], tag: "new", easy: true });
    for (const c of news) add({ code: c, hint: "nom", ask: ["numero", "prefecture"], tag: "new", easy: true });
    discover.push(...news);
    recall.push(...news.map((c): PlanItem => ({ code: c, hint: "nom", ask: ["carte", "numero", "prefecture"] })));
    for (const it of steps) if (room() > 0 && !used.has(it.code)) add(it);
  }

  // 3. S'il reste de la place : consolidation des départements déjà connus (fiche complète), les moins solides d'abord.
  if (plan.length + recall.length < size) {
    const known = Object.keys(k).filter((c) => DEP.has(c) && !used.has(c) && BASE_FACETS.some((f) => starred(k, c, f)))
      .sort((a, b) => medalOf(k, a) - medalOf(k, b) || (k[a].carte?.b ?? 0) - (k[b].carte?.b ?? 0));
    // Jamais deux inconnues : le numéro ne sert d'indice que si le joueur le connaît déjà.
    for (const c of known.slice(0, size - plan.length - recall.length)) add({ code: c, hint: pick<Hint>(starred(k, c, "numero") ? ["nom", "carte", "numero"] : ["nom", "carte"]), ask: ["carte", "nom", "numero", "prefecture"] });
  }
  return { plan: [...plan.slice(0, size - recall.length), ...recall], region, reviews, discover };
}
