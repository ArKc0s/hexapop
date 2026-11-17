import { createHmac, randomBytes } from "node:crypto";
import { DAILY_EPOCH, DAILY_ROUNDS, DEP, LEVELS, LEVEL_OF, playerLevel, sanitizeProfile, type GameConfig, type Level, type RoundResult } from "@hexa/game";
import { config } from "./config.ts";
import { db, now } from "./db.ts";

/** Jour du défi en heure de Paris (le défi change à minuit, heure française). */
export function today(t = now()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(t);
}
export function dailyNumber(day: string): number {
  return Math.round((Date.parse(day) - Date.parse(DAILY_EPOCH)) / 86_400_000) + 1;
}
/** Même graine pour tous les niveaux : les mêmes 10 départements, seules les questions changent. */
export function dailyConfig(day: string, level: Level = "normal"): GameConfig {
  const h = createHmac("sha256", config.dailySecret).update(day).digest();
  return { seed: h.readUInt32LE(0), level, input: level === "decouverte" ? "choix" : "libre", rounds: DAILY_ROUNDS };
}

export function gridOf(results: (RoundResult | undefined)[]): number[] {
  return results.map((r) => (!r ? 0 : r.accuracy >= 0.999 ? 2 : r.accuracy > 0 ? 1 : 0));
}

// Résultats joués en invité, rattachables à un compte après connexion (usage unique, jusqu'à minuit).
interface Claim { day: string; level: Level; points: number; accuracy: number; elapsedMs: number; grid: number[]; at: number }
const claims = new Map<string, Claim>();
export function newClaim(c: Omit<Claim, "at">): string {
  const id = randomBytes(18).toString("base64url");
  claims.set(id, { ...c, at: now() });
  return id;
}
/** Rattache un résultat d'invité : seulement le jour même et si le compte n'a pas déjà joué. */
export function redeemClaim(id: string, userId: number): { rank: number; players: number } | "expired" | "already" {
  const c = claims.get(id);
  claims.delete(id);
  if (!c || c.day !== today()) return "expired";
  if (!startDaily(c.day, userId, c.level)) return "already";
  return saveDaily(c.day, userId, c.points, c.accuracy, c.elapsedMs, c.grid) ?? "already";
}
setInterval(() => { const d = today(); for (const [k, v] of claims) if (v.day !== d) claims.delete(k); }, 3_600_000).unref();

export function hasPlayed(day: string, userId: number): boolean {
  return !!db.prepare("SELECT 1 FROM daily_results WHERE day = ? AND user_id = ?").get(day, userId);
}

/** Un essai par jour : la place est réservée dès le départ (quitter en cours compte comme joué). */
export function startDaily(day: string, userId: number, level: Level): boolean {
  const res = db.prepare(
    "INSERT OR IGNORE INTO daily_results (day, user_id, level, points, accuracy, elapsed_ms, grid, finished, created_at) VALUES (?, ?, ?, 0, 0, 0, '', 0, ?)",
  ).run(day, userId, level, now());
  return res.changes > 0;
}

export function saveDaily(day: string, userId: number, points: number, accuracy: number, elapsedMs: number, grid: number[]): { rank: number; players: number } | null {
  const res = db.prepare(
    "UPDATE daily_results SET points = ?, accuracy = ?, elapsed_ms = ?, grid = ?, finished = 1 WHERE day = ? AND user_id = ? AND finished = 0",
  ).run(points, accuracy, elapsedMs, grid.join(""), day, userId);
  if (!res.changes) return null;
  return rankOf(day, userId);
}

/** Rang dans le classement de son niveau. */
export function rankOf(day: string, userId: number): { rank: number; players: number; level: Level } | null {
  const me = db.prepare("SELECT level, points, elapsed_ms FROM daily_results WHERE day = ? AND user_id = ? AND finished = 1").get(day, userId) as { level: Level; points: number; elapsed_ms: number } | undefined;
  if (!me) return null;
  const { better } = db.prepare(
    "SELECT COUNT(*) AS better FROM daily_results WHERE day = ? AND level = ? AND finished = 1 AND (points > ? OR (points = ? AND elapsed_ms < ?))",
  ).get(day, me.level, me.points, me.points, me.elapsed_ms) as { better: number };
  const { players } = db.prepare("SELECT COUNT(*) AS players FROM daily_results WHERE day = ? AND level = ? AND finished = 1").get(day, me.level) as { players: number };
  return { rank: better + 1, players, level: me.level };
}

/** Classement d'un niveau ; le nombre de joueurs de chaque niveau, pour les onglets. */
export function leaderboard(day: string, level: Level = "normal", limit = 50) {
  const top = db.prepare(
    `SELECT u.pseudo AS name, u.home_dep AS home, d.points, d.accuracy, d.elapsed_ms AS elapsedMs, d.grid
     FROM daily_results d JOIN users u ON u.id = d.user_id
     WHERE d.day = ? AND d.level = ? AND d.finished = 1 ORDER BY d.points DESC, d.elapsed_ms ASC LIMIT ?`,
  ).all(day, level, limit);
  const counts = Object.fromEntries((db.prepare("SELECT level, COUNT(*) AS n FROM daily_results WHERE day = ? AND finished = 1 GROUP BY level").all(day) as { level: string; n: number }[]).map((r) => [r.level, r.n]));
  // Fierté régionale : moyenne par département de cœur (au moins 3 joueurs), dans le même niveau.
  const departements = (db.prepare(
    `SELECT u.home_dep AS code, COUNT(*) AS players, ROUND(AVG(d.points)) AS avg
     FROM daily_results d JOIN users u ON u.id = d.user_id
     WHERE d.day = ? AND d.level = ? AND d.finished = 1 AND u.home_dep IS NOT NULL GROUP BY u.home_dep HAVING COUNT(*) >= 3
     ORDER BY avg DESC LIMIT 20`,
  ).all(day, level) as { code: string; players: number; avg: number }[]).map((r) => ({ ...r, nom: DEP.get(r.code)?.nom ?? r.code }));
  return { day, number: dailyNumber(day), level, counts, top, departements };
}

/** Niveau d'un compte d'après son profil enregistré (« Ta France ») ; Découverte sans profil. */
export function accountLevel(userId: number): Level {
  const row = db.prepare("SELECT data FROM profiles WHERE user_id = ?").get(userId) as { data: string } | undefined;
  let know = {};
  try { know = sanitizeProfile(row ? JSON.parse(row.data) : null).know ?? {}; } catch { /* profil illisible */ }
  return LEVEL_OF[playerLevel(know)];
}
/** Le plus haut de deux niveaux (le profil du serveur peut avoir une partie de retard sur l'appareil). */
export const higherLevel = (a: Level, b: Level): Level => (LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b);
