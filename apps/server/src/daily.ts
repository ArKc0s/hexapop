import { createHmac, randomBytes } from "node:crypto";
import { DAILY_EPOCH, DAILY_ROUNDS, DEP, type GameConfig, type RoundResult } from "@hexa/game";
import { config } from "./config.ts";
import { db, now } from "./db.ts";

/** Jour du défi en heure de Paris (le défi change à minuit, heure française). */
export function today(t = now()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(t);
}
export function dailyNumber(day: string): number {
  return Math.round((Date.parse(day) - Date.parse(DAILY_EPOCH)) / 86_400_000) + 1;
}
export function dailyConfig(day: string): GameConfig {
  const h = createHmac("sha256", config.dailySecret).update(day).digest();
  return { seed: h.readUInt32LE(0), level: "normal", input: "libre", rounds: DAILY_ROUNDS };
}

export function gridOf(results: (RoundResult | undefined)[]): number[] {
  return results.map((r) => (!r ? 0 : r.accuracy >= 0.999 ? 2 : r.accuracy > 0 ? 1 : 0));
}

// Résultats joués en invité, rattachables à un compte après connexion (usage unique, jusqu'à minuit).
interface Claim { day: string; points: number; accuracy: number; elapsedMs: number; grid: number[]; at: number }
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
  if (!startDaily(c.day, userId)) return "already";
  return saveDaily(c.day, userId, c.points, c.accuracy, c.elapsedMs, c.grid) ?? "already";
}
setInterval(() => { const d = today(); for (const [k, v] of claims) if (v.day !== d) claims.delete(k); }, 3_600_000).unref();

export function hasPlayed(day: string, userId: number): boolean {
  return !!db.prepare("SELECT 1 FROM daily_results WHERE day = ? AND user_id = ?").get(day, userId);
}

/** Un essai par jour : la place est réservée dès le départ (quitter en cours compte comme joué). */
export function startDaily(day: string, userId: number): boolean {
  const res = db.prepare(
    "INSERT OR IGNORE INTO daily_results (day, user_id, points, accuracy, elapsed_ms, grid, finished, created_at) VALUES (?, ?, 0, 0, 0, '', 0, ?)",
  ).run(day, userId, now());
  return res.changes > 0;
}

export function saveDaily(day: string, userId: number, points: number, accuracy: number, elapsedMs: number, grid: number[]): { rank: number; players: number } | null {
  const res = db.prepare(
    "UPDATE daily_results SET points = ?, accuracy = ?, elapsed_ms = ?, grid = ?, finished = 1 WHERE day = ? AND user_id = ? AND finished = 0",
  ).run(points, accuracy, elapsedMs, grid.join(""), day, userId);
  if (!res.changes) return null;
  return rankOf(day, userId);
}

export function rankOf(day: string, userId: number): { rank: number; players: number } | null {
  const me = db.prepare("SELECT points, elapsed_ms FROM daily_results WHERE day = ? AND user_id = ? AND finished = 1").get(day, userId) as { points: number; elapsed_ms: number } | undefined;
  if (!me) return null;
  const { better } = db.prepare(
    "SELECT COUNT(*) AS better FROM daily_results WHERE day = ? AND finished = 1 AND (points > ? OR (points = ? AND elapsed_ms < ?))",
  ).get(day, me.points, me.points, me.elapsed_ms) as { better: number };
  const { players } = db.prepare("SELECT COUNT(*) AS players FROM daily_results WHERE day = ? AND finished = 1").get(day) as { players: number };
  return { rank: better + 1, players };
}

export function leaderboard(day: string, limit = 50) {
  const top = db.prepare(
    `SELECT u.pseudo AS name, u.home_dep AS home, d.points, d.accuracy, d.elapsed_ms AS elapsedMs, d.grid
     FROM daily_results d JOIN users u ON u.id = d.user_id
     WHERE d.day = ? AND d.finished = 1 ORDER BY d.points DESC, d.elapsed_ms ASC LIMIT ?`,
  ).all(day, limit);
  // Fierté régionale : moyenne par département de cœur (au moins 3 joueurs).
  const departements = (db.prepare(
    `SELECT u.home_dep AS code, COUNT(*) AS players, ROUND(AVG(d.points)) AS avg
     FROM daily_results d JOIN users u ON u.id = d.user_id
     WHERE d.day = ? AND d.finished = 1 AND u.home_dep IS NOT NULL GROUP BY u.home_dep HAVING COUNT(*) >= 3
     ORDER BY avg DESC LIMIT 20`,
  ).all(day) as { code: string; players: number; avg: number }[]).map((r) => ({ ...r, nom: DEP.get(r.code)?.nom ?? r.code }));
  return { day, number: dailyNumber(day), top, departements };
}
