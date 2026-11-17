// Méta-jeu v1.1 : XP et niveaux, série quotidienne, quêtes du jour, Tour de France (étoiles par
// région), album de plaques et badges. Fonctions pures : le client les applique (invité ou compte),
// le serveur fusionne les profils synchronisés.
import { DEPARTEMENTS, DEP, REGIONS, REGION_ITEMS, R_METRO, R_OUTRE_MER } from "./data.ts";
import { ATLASES, isAtlas, type AtlasId } from "./atlas.ts";
import { rng, shuffle } from "./random.ts";
import type { InputMode, Level, RoundResult } from "./round.ts";
import { learn, medalOf, mergeKnowledge, sanitizeKnowledge, type Knowledge, type KnowledgeGain, type RoundPlay } from "./knowledge.ts";

// ---------- jours ----------
/** Jour calendaire à Paris (AAAA-MM-JJ). */
export function dayKey(t: number): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(t);
}
function addDays(day: string, n: number): string {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Lundi de la semaine du jour donné. */
function weekKey(day: string): string {
  const d = new Date(day + "T12:00:00Z");
  return addDays(day, -((d.getUTCDay() + 6) % 7));
}

// ---------- profil ----------
export interface Profile {
  v: 1;
  xp: number;
  streak: { count: number; best: number; last: string | null; jokers: number; jokerWeek: string | null };
  quests: { day: string; progress: Record<string, number> };
  /** Étoiles par région (code INSEE, ou « OM » pour l'outre-mer). */
  stars: Record<string, number>;
  /** Région de départ du Tour de France. */
  tourStart: string | null;
  /** Palier de la vignette par département : 1 bronze (4 propositions), 2 argent (clavier), 3 or (expert). */
  tiers: Record<string, number>;
  badges: Record<string, number>;
  /** Connaissance par département et par facette (étoiles, médailles). Absente = profil d'avant la v1.4, à reprendre. */
  know?: Knowledge;
  /** Département d'origine (« Tu viens d'où ? ») : la séance commence par sa région. */
  home?: string;
  /** Région choisie sur la carte de l'accueil pour la séance (sinon la suivante dans l'ordre de découverte). */
  focus?: string;
  /** Date du dernier choix de région (ou de son annulation) : entre deux appareils, le plus récent l'emporte. */
  focusAt?: number;
  /** Atlas affiché (un atlas = un monde, docs/atlas.md) ; absent = départements. */
  atlas?: AtlasId;
  /** Date du dernier changement d'atlas : entre deux appareils, le plus récent l'emporte. */
  atlasAt?: number;
  /** Kilomètres (ex-XP) de la semaine en cours, pour les ligues et entre amis. */
  week?: { id: string; km: number };
  /** Parties du jour, pour l'objectif personnel facultatif. */
  today?: { day: string; games: number };
  stats: { games: number; rounds: number; perfectRounds: number; bestCombo: number; dailyPlayed: number; duelsWon: number; marathons: number };
}

export function emptyProfile(): Profile {
  return {
    v: 1, xp: 0,
    streak: { count: 0, best: 0, last: null, jokers: 1, jokerWeek: null },
    quests: { day: "", progress: {} },
    stars: {}, tourStart: null, tiers: {}, badges: {},
    stats: { games: 0, rounds: 0, perfectRounds: 0, bestCombo: 0, dailyPlayed: 0, duelsWon: 0, marathons: 0 },
  };
}

/** Fusion de deux profils (appareils différents) : on garde toujours le plus avancé. */
export function mergeProfiles(a: Profile, b: Profile): Profile {
  const p = emptyProfile();
  p.xp = Math.max(a.xp, b.xp);
  const s = (a.streak.last ?? "") >= (b.streak.last ?? "") ? a.streak : b.streak;
  p.streak = { ...s, best: Math.max(a.streak.best, b.streak.best) };
  const q = a.quests.day >= b.quests.day ? a.quests : b.quests;
  const q2 = a.quests.day === b.quests.day ? b.quests : null;
  p.quests = { day: q.day, progress: { ...q.progress } };
  if (q2) for (const [k, v] of Object.entries(q2.progress)) p.quests.progress[k] = Math.max(p.quests.progress[k] ?? 0, v);
  for (const k of new Set([...Object.keys(a.stars), ...Object.keys(b.stars)])) p.stars[k] = Math.max(a.stars[k] ?? 0, b.stars[k] ?? 0);
  p.tourStart = a.tourStart ?? b.tourStart;
  for (const k of new Set([...Object.keys(a.tiers), ...Object.keys(b.tiers)])) if (DEP.has(k)) p.tiers[k] = Math.max(a.tiers[k] ?? 0, b.tiers[k] ?? 0);
  p.badges = { ...b.badges, ...a.badges };
  if (a.know || b.know) p.know = mergeKnowledge(a.know ?? {}, b.know ?? {});
  p.home = b.home ?? a.home;
  // Choix de région : le plus récent gagne, y compris une annulation (sinon le serveur rétablissait l'ancien choix).
  const f = (b.focusAt ?? 0) >= (a.focusAt ?? 0) ? b : a;
  if (f.focus) p.focus = f.focus;
  if (f.focusAt) p.focusAt = f.focusAt;
  const at = (b.atlasAt ?? 0) >= (a.atlasAt ?? 0) ? b : a;
  if (at.atlas) p.atlas = at.atlas;
  if (at.atlasAt) p.atlasAt = at.atlasAt;
  const later = <T extends { id?: string; day?: string }>(x?: T, y?: T, key: "id" | "day" = "id") => (!x ? y : !y ? x : (x[key] ?? "") >= (y[key] ?? "") ? x : y);
  if (a.week || b.week) p.week = a.week && b.week && a.week.id === b.week.id ? { id: a.week.id, km: Math.max(a.week.km, b.week.km) } : later(a.week, b.week);
  if (a.today || b.today) p.today = a.today && b.today && a.today.day === b.today.day ? { day: a.today.day, games: Math.max(a.today.games, b.today.games) } : later(a.today, b.today, "day");
  for (const k of Object.keys(p.stats) as (keyof Profile["stats"])[]) p.stats[k] = Math.max(a.stats[k] ?? 0, b.stats[k] ?? 0);
  return p;
}

/** Nettoie un profil reçu (stockage local corrompu ou client malveillant). */
export function sanitizeProfile(raw: unknown): Profile {
  const p = emptyProfile();
  if (!raw || typeof raw !== "object") return p;
  const r = raw as Partial<Profile>;
  const num = (v: unknown, max = 1e9) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
  const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  p.xp = num(r.xp, 1e8);
  if (r.streak) p.streak = { count: num(r.streak.count, 1e5), best: num(r.streak.best, 1e5), last: day(r.streak.last), jokers: num(r.streak.jokers, 1), jokerWeek: day(r.streak.jokerWeek) };
  if (r.quests && day(r.quests.day)) {
    p.quests.day = r.quests.day;
    for (const [k, v] of Object.entries(r.quests.progress ?? {})) if (QUEST_POOL.some((q) => q.id === k)) p.quests.progress[k] = num(v, 1000);
  }
  for (const [k, v] of Object.entries(r.stars ?? {})) if (TOUR_REGIONS.some((t) => t.code === k)) p.stars[k] = num(v, 3);
  p.tourStart = typeof r.tourStart === "string" && TOUR_REGIONS.some((t) => t.code === r.tourStart) ? r.tourStart : null;
  // Ancien format (v1.1 : liste de plaques) : chaque plaque devient du bronze.
  const legacy = (r as { plates?: unknown }).plates;
  if (Array.isArray(legacy)) for (const c of legacy) if (typeof c === "string" && DEP.has(c)) p.tiers[c] = 1;
  for (const [k, v] of Object.entries(r.tiers ?? {})) if (DEP.has(k)) p.tiers[k] = Math.max(p.tiers[k] ?? 0, num(v, 3));
  for (const [k, v] of Object.entries(r.badges ?? {})) if (BADGES.some((b) => b.id === k)) p.badges[k] = num(v, 1e13);
  const know = sanitizeKnowledge(r.know);
  if (know) p.know = know;
  if (typeof r.home === "string" && DEP.has(r.home)) p.home = r.home;
  if (typeof r.focus === "string" && TOUR.has(r.focus)) p.focus = r.focus;
  if (isAtlas(r.atlas)) p.atlas = r.atlas;
  if (r.atlasAt) p.atlasAt = num(r.atlasAt, 8.64e15);
  if (r.focusAt) p.focusAt = num(r.focusAt, 8.64e15);
  if (r.week && day(r.week.id)) p.week = { id: r.week.id, km: num(r.week.km, 1e8) };
  if (r.today && day(r.today.day)) p.today = { day: r.today.day, games: num(r.today.games, 1e4) };
  for (const k of Object.keys(p.stats) as (keyof Profile["stats"])[]) p.stats[k] = num(r.stats?.[k], 1e7);
  return p;
}

// ---------- paliers de plaques ----------
export const TIER_NAMES = ["", "bronze", "argent", "or"] as const;
export const MAX_TIER_POINTS = 303;
/** Palier gagné par une réponse parfaite selon la difficulté. */
export function tierFor(level: Level, input: InputMode): number {
  if (level === "expert") return 3;
  return input === "libre" ? 2 : 1;
}
export const platesOwned = (p: Profile) => Object.values(p.tiers).filter((t) => t > 0).length;
const medal = (p: Profile, code: string) => (p.know ? medalOf(p.know, code) : 0);
/** Nombre de départements ayant au moins cette médaille. */
export const medalCount = (p: Profile, min: number, a: AtlasId = "france") => ATLASES[a].items.filter((d) => medal(p, d.code) >= min).length;
export const tierPoints = (p: Profile) => Object.values(p.tiers).reduce((n, t) => n + t, 0);

// ---------- niveaux ----------
/** XP cumulée pour atteindre le niveau n (niveau 1 = 0, 2 = 100, 3 = 300, 4 = 600…). */
export const xpForLevel = (n: number) => 50 * n * (n - 1);
export function levelInfo(xp: number) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const from = xpForLevel(level), to = xpForLevel(level + 1);
  return { level, into: xp - from, need: to - from, ratio: (xp - from) / (to - from) };
}

// ---------- Tour de France ----------
export interface TourRegion { code: string; nom: string; deps: string[]; neighbors: string[] }
export const OUTRE_MER = "OM";
export const OM_UNLOCK_STARS = 20;

export const TOUR_REGIONS: TourRegion[] = (() => {
  const metro = REGIONS.filter((r) => DEPARTEMENTS.some((d) => d.region === r.code && !d.outreMer));
  const out: TourRegion[] = metro.map((r) => {
    const deps = DEPARTEMENTS.filter((d) => d.region === r.code).map((d) => d.code);
    const neighbors = new Set<string>();
    for (const c of deps) for (const n of DEP.get(c)!.limitrophes) { const nr = DEP.get(n)!.region; if (nr !== r.code) neighbors.add(nr); }
    return { code: r.code, nom: r.nom, deps, neighbors: [...neighbors] };
  });
  // La Corse n'a pas de voisin terrestre : on la relie à Provence-Alpes-Côte d'Azur.
  const cor = out.find((r) => r.deps.includes("2A")), pac = out.find((r) => r.deps.includes("13"));
  if (cor && pac) { cor.neighbors.push(pac.code); pac.neighbors.push(cor.code); }
  out.push({ code: OUTRE_MER, nom: "Outre-mer", deps: DEPARTEMENTS.filter((d) => d.outreMer).map((d) => d.code), neighbors: [] });
  return out;
})();
/** Atlas Régions : deux groupes pour les séances, la métropole puis l'outre-mer. */
export const REGION_GROUPS: TourRegion[] = [
  { code: R_METRO, nom: "Métropole", deps: REGION_ITEMS.filter((r) => !r.outreMer).map((r) => r.code), neighbors: [R_OUTRE_MER] },
  { code: R_OUTRE_MER, nom: "Outre-mer", deps: REGION_ITEMS.filter((r) => r.outreMer).map((r) => r.code), neighbors: [] },
];
/** Groupes de séance d'un atlas (départements : les régions et l'outre-mer). */
export const groupsOf = (a: AtlasId): TourRegion[] => (a === "regions" ? REGION_GROUPS : TOUR_REGIONS);
export const TOUR = new Map([...TOUR_REGIONS, ...REGION_GROUPS].map((r) => [r.code, r]));
export const tourRegionOf = (code: string) => [...TOUR_REGIONS, ...REGION_GROUPS].find((r) => r.deps.includes(code))!;
export const totalStars = (p: Profile) => Object.values(p.stars).reduce((n, s) => n + s, 0);

export type TourState = "locked" | "open" | "done";
export function tourState(p: Profile, code: string): TourState {
  const stars = p.stars[code] ?? 0;
  if (stars > 0) return "done";
  if (code === OUTRE_MER) return totalStars(p) >= OM_UNLOCK_STARS ? "open" : "locked";
  if (!p.tourStart || p.tourStart === code) return "open";
  return TOUR.get(code)!.neighbors.some((n) => (p.stars[n] ?? 0) > 0) ? "open" : "locked";
}

/** Étoiles d'une manche de Tour : ★ terminer (60 %), ★★ sans faute, ★★★ en expert (90 %). */
export function starsFor(level: Level, accuracy: number): number {
  if (level === "expert" && accuracy >= 0.9) return 3;
  if (accuracy >= 0.999) return 2;
  if (accuracy >= 0.6) return 1;
  return 0;
}

/** Prochaine région conseillée : la région ouverte la moins étoilée, en partant de la dernière jouée. */
export function nextTourRegion(p: Profile): TourRegion | null {
  const playable = TOUR_REGIONS.filter((r) => tourState(p, r.code) !== "locked" && (p.stars[r.code] ?? 0) < 3);
  if (!playable.length) return null;
  const start = p.tourStart ? TOUR.get(p.tourStart) : null;
  if (start && (p.stars[start.code] ?? 0) === 0) return start;
  return playable.sort((a, b) => (p.stars[a.code] ?? 0) - (p.stars[b.code] ?? 0) || a.deps.length - b.deps.length)[0];
}

// ---------- quêtes ----------
export type GameMode = "apprendre" | "eclair" | "region" | "marathon" | "tour" | "daily" | "multi" | "seance";
export interface GameReport {
  mode: GameMode;
  level: Level;
  /** Façon de répondre : décide du palier des plaques gagnées. */
  input: InputMode;
  results: RoundResult[];
  /** Région jouée (Tour de France). */
  region?: string;
  /** Duel gagné (multi). */
  won?: boolean;
  now: number;
  /** Partie d'apprentissage (solo) : fait progresser les étoiles. */
  learn?: boolean;
  /** Indice, champs et aide de chaque tour, alignés sur `results`. */
  rounds?: RoundPlay[];
}
interface Ctx { report: GameReport; perfect: RoundResult[]; bestCombo: number; starsGained: number }

export interface QuestDef { id: string; label: string; target: number; measure: (c: Ctx) => number; mode: "add" | "max" }
export const QUEST_POOL: QuestDef[] = [
  { id: "perfect10", label: "Réussis 10 départements sans faute", target: 10, measure: (c) => c.perfect.length, mode: "add" },
  { id: "perfect20", label: "Réussis 20 départements sans faute", target: 20, measure: (c) => c.perfect.length, mode: "add" },
  { id: "combo5", label: "Enchaîne un combo ×5", target: 5, measure: (c) => c.bestCombo, mode: "max" },
  { id: "combo8", label: "Enchaîne un combo ×8", target: 8, measure: (c) => c.bestCombo, mode: "max" },
  { id: "daily", label: "Joue le défi du jour", target: 1, measure: (c) => (c.report.mode === "daily" ? 1 : 0), mode: "add" },
  { id: "star", label: "Gagne une étoile au Tour de France", target: 1, measure: (c) => c.starsGained, mode: "add" },
  { id: "expert", label: "Termine une partie en expert", target: 1, measure: (c) => (c.report.level === "expert" && c.report.results.length >= 5 ? 1 : 0), mode: "add" },
  { id: "fast5", label: "Réponds juste en moins de 3 s, 5 fois", target: 5, measure: (c) => c.perfect.filter((r) => r.elapsedMs < 3000).length, mode: "add" },
  { id: "drom2", label: "Réussis 2 départements d'outre-mer", target: 2, measure: (c) => c.perfect.filter((r) => DEP.get(r.code)?.outreMer).length, mode: "add" },
  { id: "multi", label: "Joue une partie entre amis", target: 1, measure: (c) => (c.report.mode === "multi" ? 1 : 0), mode: "add" },
];
export const QUEST_XP = 50;

/** Les 3 quêtes du jour : mêmes pour tout le monde, une seule par famille. */
export function questsFor(day: string): QuestDef[] {
  const families = new Map<string, QuestDef[]>();
  for (const q of QUEST_POOL) { const f = q.id.replace(/\d+$/, ""); families.set(f, [...(families.get(f) ?? []), q]); }
  const r = rng(Number(day.replaceAll("-", "")));
  return shuffle([...families.values()], r).slice(0, 3).map((f) => f[Math.floor(r() * f.length)]);
}

// ---------- badges ----------
export interface BadgeDef { id: string; nom: string; desc: string; test: (c: Ctx, p: Profile) => boolean }
const has = (rs: RoundResult[], code: string) => rs.some((r) => r.code === code);
export const BADGES: BadgeDef[] = [
  { id: "premier", nom: "Premier pas", desc: "Terminer sa première partie", test: (_c, p) => p.stats.games >= 1 },
  { id: "bout-du-monde", nom: "Bout du monde", desc: "Trouver le Finistère sans faute en moins de 2 s", test: (c) => c.perfect.some((r) => r.code === "29" && r.elapsedMs < 2000) },
  { id: "tour-de-corse", nom: "Tour de Corse", desc: "Réussir la Corse-du-Sud et la Haute-Corse dans la même partie", test: (c) => has(c.perfect, "2A") && has(c.perfect, "2B") },
  { id: "petite-couronne", nom: "Petite couronne", desc: "Réussir Paris, les Hauts-de-Seine, la Seine-Saint-Denis et le Val-de-Marne dans la même partie", test: (c) => ["75", "92", "93", "94"].every((x) => has(c.perfect, x)) },
  { id: "eclair", nom: "Éclair", desc: "Une réponse parfaite en moins de 1,5 s", test: (c) => c.perfect.some((r) => r.elapsedMs < 1500) },
  { id: "sans-faute", nom: "Sans faute", desc: "Une partie d'au moins 10 départements sans aucune erreur", test: (c) => c.report.results.length >= 10 && c.perfect.length === c.report.results.length },
  { id: "combo10", nom: "Inarrêtable", desc: "Un combo ×10", test: (c) => c.bestCombo >= 10 },
  { id: "marathon", nom: "Marathonien", desc: "Terminer un Marathon des 101 départements", test: (c) => c.report.mode === "marathon" && c.report.results.length >= 101 },
  { id: "expert", nom: "Sous-préfet", desc: "Terminer une partie en expert", test: (c) => c.report.level === "expert" && c.report.results.length >= 5 },
  { id: "outre-mer", nom: "Ultramarin", desc: "Les 5 départements d'outre-mer en bronze", test: (_c, p) => DEPARTEMENTS.filter((d) => d.outreMer).every((d) => medal(p, d.code) >= 1) },
  { id: "album-50", nom: "Collectionneur", desc: "50 départements en bronze", test: (_c, p) => medalCount(p, 1) >= 50 },
  { id: "album-101", nom: "Album complet", desc: "Les 101 départements en bronze", test: (_c, p) => medalCount(p, 1) >= 101 },
  { id: "argent-101", nom: "Tout en argent", desc: "Les 101 départements au moins en argent", test: (_c, p) => medalCount(p, 2) >= 101 },
  { id: "or-101", nom: "Tout en or", desc: "Les 101 départements en or", test: (_c, p) => medalCount(p, 3) >= 101 },
  // Atlas Régions : ses Légendes du Hall of Fame (docs/atlas.md).
  { id: "regions-18", nom: "Les 18 régions", desc: "Toutes les régions en bronze", test: (_c, p) => medalCount(p, 1, "regions") >= 18 },
  { id: "regions-argent", nom: "Régions en argent", desc: "Toutes les régions au moins en argent", test: (_c, p) => medalCount(p, 2, "regions") >= 18 },
  { id: "regions-or", nom: "Régions en or", desc: "Toutes les régions en or", test: (_c, p) => medalCount(p, 3, "regions") >= 18 },
  { id: "region-3", nom: "Chez soi", desc: "Une région entière en bronze", test: (_c, p) => TOUR_REGIONS.some((r) => r.deps.every((c) => medal(p, c) >= 1)) },
  { id: "tour-complet", nom: "Tour de France", desc: "Au moins une étoile dans chaque région", test: (_c, p) => TOUR_REGIONS.every((r) => r.deps.some((c) => (p.know?.[c] ? Object.values(p.know[c]).some((x) => x?.s) : false))) },
  { id: "serie-7", nom: "Une semaine", desc: "Jouer 7 jours d'affilée", test: (_c, p) => p.streak.count >= 7 },
  { id: "serie-30", nom: "Un mois", desc: "Jouer 30 jours d'affilée", test: (_c, p) => p.streak.count >= 30 },
  { id: "defi-7", nom: "Habitué du défi", desc: "Jouer 7 défis du jour", test: (_c, p) => p.stats.dailyPlayed >= 7 },
  { id: "duel", nom: "Duelliste", desc: "Gagner un duel", test: (_c, p) => p.stats.duelsWon >= 1 },
];
export const BADGE = new Map(BADGES.map((b) => [b.id, b]));

// ---------- application d'une partie ----------
export interface Rewards {
  xp: number;
  xpBefore: number;
  levelBefore: number;
  levelAfter: number;
  bestCombo: number;
  /** Étoiles gagnées et médailles montées pendant la partie (parties d'apprentissage). */
  knowledge: KnowledgeGain | null;
  newBadges: string[];
  stars: { region: string; before: number; after: number } | null;
  questsDone: string[];
  streak: { count: number; extended: boolean; jokerUsed: boolean };
}

/** Combo à chaque tour : nombre de réponses parfaites consécutives (0 si raté). */
export function combos(results: RoundResult[]): number[] {
  let c = 0;
  return results.map((r) => (c = r.accuracy >= 0.999 ? c + 1 : 0));
}

/** XP d'un tour : 10 par champ juste, bonus de combo (+5 par cran, plafonné à ×10). */
export function roundXp(r: RoundResult, combo: number): number {
  const base = Math.round(10 * r.fields.reduce((n, f) => n + f.score, 0));
  return base + (combo >= 2 ? 5 * Math.min(combo, 10) : 0);
}

export function applyGame(prev: Profile, report: GameReport): { profile: Profile; rewards: Rewards } {
  const p: Profile = structuredClone(prev);
  const today = dayKey(report.now);
  const cs = combos(report.results);
  const perfect = report.results.filter((r) => r.accuracy >= 0.999);
  const bestCombo = Math.max(0, ...cs);

  // XP de jeu
  let xp = report.results.reduce((n, r, i) => n + roundXp(r, cs[i]), 0);
  if (report.results.length >= 10 && perfect.length === report.results.length) xp += 50;
  if (report.mode === "daily") xp += 50;
  if (report.won) xp += 100;

  // Série quotidienne (un joker par semaine rattrape un jour manqué)
  const week = weekKey(today);
  if (p.streak.jokerWeek !== week) { p.streak.jokers = 1; p.streak.jokerWeek = week; }
  let extended = false, jokerUsed = false;
  if (p.streak.last !== today) {
    if (p.streak.last === addDays(today, -1)) p.streak.count += 1;
    else if (p.streak.last === addDays(today, -2) && p.streak.jokers > 0) { p.streak.jokers -= 1; p.streak.count += 1; jokerUsed = true; }
    else p.streak.count = 1;
    p.streak.last = today;
    p.streak.best = Math.max(p.streak.best, p.streak.count);
    extended = true;
  }

  // Étoiles du Tour
  let stars: Rewards["stars"] = null;
  if (report.mode === "tour" && report.region && TOUR.has(report.region)) {
    const acc = report.results.reduce((n, r) => n + r.accuracy, 0) / Math.max(1, report.results.length);
    const before = p.stars[report.region] ?? 0;
    const after = Math.max(before, starsFor(report.level, acc));
    p.stars[report.region] = after;
    if (!p.tourStart) p.tourStart = report.region;
    stars = { region: report.region, before, after };
  }
  const starsGained = stars ? stars.after - stars.before : 0;

  // Étoiles et médailles : ce que le joueur sait vraiment (parties d'apprentissage seulement)
  let knowledge: KnowledgeGain | null = null;
  if (report.learn && report.rounds) {
    const { know, gain } = learn(p.know ?? {}, report.results, report.rounds, report.now);
    p.know = know;
    knowledge = gain;
  }

  // Statistiques
  p.stats.games += 1;
  p.stats.rounds += report.results.length;
  p.stats.perfectRounds += perfect.length;
  p.stats.bestCombo = Math.max(p.stats.bestCombo, bestCombo);
  if (report.mode === "daily") p.stats.dailyPlayed += 1;
  if (report.mode === "marathon" && report.results.length >= 101) p.stats.marathons += 1;
  if (report.won) p.stats.duelsWon += 1;

  // Les quêtes du jour sont retirées (v1.5) : la série et l'objectif personnel portent le rendez-vous quotidien.
  const ctx: Ctx = { report, perfect, bestCombo, starsGained };
  const questsDone: string[] = [];
  p.today = p.today?.day === today ? { day: today, games: p.today.games + 1 } : { day: today, games: 1 };

  const xpBefore = p.xp;
  p.xp += xp;
  // Kilomètres de la semaine (ex-XP) : base des futures ligues.
  p.week = p.week?.id === week ? { id: week, km: p.week.km + xp } : { id: week, km: xp };

  // Badges (après mise à jour du profil)
  const newBadges = BADGES.filter((b) => !p.badges[b.id] && b.test(ctx, p)).map((b) => b.id);
  for (const id of newBadges) p.badges[id] = report.now;

  return {
    profile: p,
    rewards: {
      xp, xpBefore, levelBefore: levelInfo(xpBefore).level, levelAfter: levelInfo(p.xp).level,
      bestCombo, knowledge, newBadges, stars, questsDone,
      streak: { count: p.streak.count, extended, jokerUsed },
    },
  };
}

/** La série est-elle encore vivante aujourd'hui (jouée hier ou aujourd'hui, ou rattrapable) ? */
export function liveStreak(p: Profile, now: number): number {
  const today = dayKey(now);
  if (!p.streak.last) return 0;
  if (p.streak.last === today || p.streak.last === addDays(today, -1)) return p.streak.count;
  if (p.streak.last === addDays(today, -2) && (p.streak.jokers > 0 || p.streak.jokerWeek !== weekKey(today))) return p.streak.count;
  return 0;
}
