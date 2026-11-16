// Méta-jeu v1.1 : XP et niveaux, série quotidienne, quêtes du jour, Tour de France (étoiles par
// région), album de plaques et badges. Fonctions pures : le client les applique (invité ou compte),
// le serveur fusionne les profils synchronisés.
import { DEPARTEMENTS, DEP, REGIONS } from "./data.ts";
import { rng, shuffle } from "./random.ts";
import type { Level, RoundResult } from "./round.ts";

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
  plates: string[];
  badges: Record<string, number>;
  stats: { games: number; rounds: number; perfectRounds: number; bestCombo: number; dailyPlayed: number; duelsWon: number; marathons: number };
}

export function emptyProfile(): Profile {
  return {
    v: 1, xp: 0,
    streak: { count: 0, best: 0, last: null, jokers: 1, jokerWeek: null },
    quests: { day: "", progress: {} },
    stars: {}, tourStart: null, plates: [], badges: {},
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
  p.plates = [...new Set([...a.plates, ...b.plates])].filter((c) => DEP.has(c));
  p.badges = { ...b.badges, ...a.badges };
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
  p.plates = Array.isArray(r.plates) ? [...new Set(r.plates.filter((c): c is string => typeof c === "string" && DEP.has(c)))] : [];
  for (const [k, v] of Object.entries(r.badges ?? {})) if (BADGES.some((b) => b.id === k)) p.badges[k] = num(v, 1e13);
  for (const k of Object.keys(p.stats) as (keyof Profile["stats"])[]) p.stats[k] = num(r.stats?.[k], 1e7);
  return p;
}

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
export const TOUR = new Map(TOUR_REGIONS.map((r) => [r.code, r]));
export const tourRegionOf = (code: string) => TOUR_REGIONS.find((r) => r.deps.includes(code))!;
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
export type GameMode = "apprendre" | "eclair" | "region" | "marathon" | "tour" | "daily" | "multi";
export interface GameReport {
  mode: GameMode;
  level: Level;
  results: RoundResult[];
  /** Région jouée (Tour de France). */
  region?: string;
  /** Duel gagné (multi). */
  won?: boolean;
  now: number;
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
  { id: "outre-mer", nom: "Ultramarin", desc: "Collectionner les 5 plaques d'outre-mer", test: (_c, p) => DEPARTEMENTS.filter((d) => d.outreMer).every((d) => p.plates.includes(d.code)) },
  { id: "album-50", nom: "Collectionneur", desc: "50 plaques dans l'album", test: (_c, p) => p.plates.length >= 50 },
  { id: "album-101", nom: "Album complet", desc: "Les 101 plaques", test: (_c, p) => p.plates.length >= 101 },
  { id: "region-3", nom: "Chez soi", desc: "3 étoiles dans une région", test: (_c, p) => Object.values(p.stars).some((s) => s >= 3) },
  { id: "tour-complet", nom: "Tour de France", desc: "Au moins une étoile dans toutes les régions", test: (_c, p) => TOUR_REGIONS.every((r) => (p.stars[r.code] ?? 0) > 0) },
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
  newPlates: string[];
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

  // Album
  const newPlates = [...new Set(perfect.map((r) => r.code))].filter((c) => !p.plates.includes(c));
  p.plates.push(...newPlates);

  // Statistiques
  p.stats.games += 1;
  p.stats.rounds += report.results.length;
  p.stats.perfectRounds += perfect.length;
  p.stats.bestCombo = Math.max(p.stats.bestCombo, bestCombo);
  if (report.mode === "daily") p.stats.dailyPlayed += 1;
  if (report.mode === "marathon" && report.results.length >= 101) p.stats.marathons += 1;
  if (report.won) p.stats.duelsWon += 1;

  // Quêtes du jour
  if (p.quests.day !== today) p.quests = { day: today, progress: {} };
  const ctx: Ctx = { report, perfect, bestCombo, starsGained };
  const questsDone: string[] = [];
  for (const q of questsFor(today)) {
    const before = p.quests.progress[q.id] ?? 0;
    if (before >= q.target) continue;
    const m = q.measure(ctx);
    const after = Math.min(q.target, q.mode === "max" ? Math.max(before, m) : before + m);
    p.quests.progress[q.id] = after;
    if (after >= q.target) { questsDone.push(q.id); xp += QUEST_XP; }
  }

  const xpBefore = p.xp;
  p.xp += xp;

  // Badges (après mise à jour du profil)
  const newBadges = BADGES.filter((b) => !p.badges[b.id] && b.test(ctx, p)).map((b) => b.id);
  for (const id of newBadges) p.badges[id] = report.now;

  return {
    profile: p,
    rewards: {
      xp, xpBefore, levelBefore: levelInfo(xpBefore).level, levelAfter: levelInfo(p.xp).level,
      bestCombo, newPlates, newBadges, stars, questsDone,
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
