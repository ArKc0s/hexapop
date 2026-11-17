import { createHmac, randomBytes } from "node:crypto";
import { ATLASES, DAILY_EPOCH, DAILY_ROUNDS, DEP, LEVELS, LEVEL_OF, playerLevel, sanitizeProfile, type AtlasId, type GameConfig, type Level, type RoundResult } from "@hexa/game";
import { config } from "./config.ts";
import { db, now } from "./db.ts";

/** Jour du défi en heure de Paris (le défi change à minuit, heure française). */
export function today(t = now()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(t);
}
export function dailyNumber(day: string): number {
  return Math.round((Date.parse(day) - Date.parse(DAILY_EPOCH)) / 86_400_000) + 1;
}
/** Clé du défi en base : le jour pour les départements, « atlas:jour » pour les autres atlas (un défi par atlas). */
export function dailyKey(day: string, atlas: AtlasId = "france"): string {
  return atlas === "france" ? day : `${atlas}:${day}`;
}
/** Jour réel d'une clé de défi (« regions:2026-11-17 » → « 2026-11-17 »). */
export const dayOfKey = (key: string) => key.slice(key.lastIndexOf(":") + 1);
/** Même graine pour tous les niveaux : les mêmes départements (ou régions), seules les questions changent. */
export function dailyConfig(day: string, level: Level = "normal", atlas: AtlasId = "france"): GameConfig {
  const h = createHmac("sha256", config.dailySecret).update(dailyKey(day, atlas)).digest();
  return { seed: h.readUInt32LE(0), atlas, level, input: level === "decouverte" ? "choix" : "libre", rounds: atlas === "france" ? DAILY_ROUNDS : ATLASES[atlas].dailyRounds };
}

export function gridOf(results: (RoundResult | undefined)[]): number[] {
  return results.map((r) => (!r ? 0 : r.accuracy >= 0.999 ? 2 : r.accuracy > 0 ? 1 : 0));
}

// Résultats joués en invité, rattachables à un compte après connexion (usage unique, jusqu'à minuit).
// En base (et non en mémoire) : un invité qui finit son défi sur l'ancienne version peut le rattacher sur la nouvelle.
interface Claim { day: string; level: Level; points: number; accuracy: number; elapsedMs: number; grid: number[]; guestId?: string }
db.exec("CREATE TABLE IF NOT EXISTS daily_claims (id TEXT PRIMARY KEY, day TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL)");
export function newClaim(c: Claim): string {
  const id = randomBytes(18).toString("base64url");
  db.prepare("INSERT INTO daily_claims (id, day, data, created_at) VALUES (?, ?, ?, ?)").run(id, c.day, JSON.stringify(c), now());
  return id;
}
/** Rattache un résultat d'invité : seulement le jour même et si le compte n'a pas déjà joué. */
export function redeemClaim(id: string, userId: number): { rank: number; players: number } | "expired" | "already" {
  const row = db.prepare("DELETE FROM daily_claims WHERE id = ? RETURNING data").get(id) as { data: string } | undefined;
  const c = row ? (JSON.parse(row.data) as Claim) : null;
  if (!c || dayOfKey(c.day) !== today()) return "expired";
  // Invité classé : son résultat passe sous le compte (et ses autres jours avec lui).
  if (c.guestId) { adoptGuest(c.guestId, userId); const r = rankOf(c.day, userId); if (r) return r; }
  if (!startDaily(c.day, userId, c.level ?? "normal")) return "already";
  return saveDaily(c.day, userId, c.points, c.accuracy, c.elapsedMs, c.grid) ?? "already";
}
setInterval(() => { db.prepare("DELETE FROM daily_claims WHERE substr(day, -10) < ?").run(today()); }, 3_600_000).unref();

// ---------- invités au classement (pseudo généré, un défi par navigateur et par jour) ----------
db.exec(`
CREATE TABLE IF NOT EXISTS daily_guest_results (
  day TEXT NOT NULL, guest_id TEXT NOT NULL, name TEXT NOT NULL, home TEXT, level TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0, accuracy REAL NOT NULL DEFAULT 0, elapsed_ms INTEGER NOT NULL DEFAULT 0, grid TEXT NOT NULL DEFAULT '',
  finished INTEGER NOT NULL DEFAULT 0, fp TEXT, created_at INTEGER NOT NULL, PRIMARY KEY (day, guest_id)
);
CREATE INDEX IF NOT EXISTS daily_guest_rank ON daily_guest_results(day, level, points DESC, elapsed_ms ASC);
DROP VIEW IF EXISTS daily_all;
CREATE VIEW daily_all AS
  SELECT d.day, d.level, d.points, d.accuracy, d.elapsed_ms, d.grid, d.finished, u.pseudo AS name, u.home_dep AS home, 0 AS guest, 'u' || d.user_id AS who
    FROM daily_results d JOIN users u ON u.id = d.user_id
  UNION ALL
  SELECT g.day, g.level, g.points, g.accuracy, g.elapsed_ms, g.grid, g.finished, g.name, g.home, 1, 'g' || g.guest_id FROM daily_guest_results g;
`);
/** Résultats d'invités d'une même connexion, par jour : au-delà, on ne les classe plus (vider son navigateur pour rejouer). */
export const GUEST_PER_CONNECTION = 3;
export const isGuestId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{16,40}$/.test(v);

const ANIMALS = ["Mouette", "Loutre", "Hérisson", "Renard", "Marmotte", "Chouette", "Hirondelle", "Blaireau", "Écureuil", "Bouquetin", "Cigogne", "Grenouille", "Libellule", "Salamandre", "Lièvre", "Mésange", "Héron", "Chamois", "Castor", "Goéland", "Coccinelle", "Belette", "Pie", "Rouge-gorge", "Tortue", "Phoque", "Dauphin", "Flamant", "Pélican", "Lynx", "Ours", "Loup", "Cerf", "Abeille", "Escargot", "Moineau", "Macareux", "Huppe", "Martin-pêcheur", "Vanneau"];
/** Pseudo d'invité, toujours le même pour un navigateur : « Mouette du Finistère », « Loutre de la Somme »… */
export function guestDisplayName(guestId: string, home: string | null): string {
  const h = createHmac("sha256", "hexa-invite").update(guestId).digest();
  const animal = ANIMALS[h.readUInt16LE(0) % ANIMALS.length];
  const d = home ? DEP.get(home) : null;
  if (!d) return `${animal} de passage`;
  const de = d.article === "le" ? `du ${d.nom}` : d.article === "les" ? `des ${d.nom}` : d.article === "la" ? `de la ${d.nom}` : d.article === "l'" ? `de l'${d.nom}` : `de ${d.nom}`;
  return `${animal} ${de}`;
}
const guestFp = (ip: string) => createHmac("sha256", config.dailySecret).update(`invite|${today()}|${ip}`).digest("base64url").slice(0, 16);

/** Réserve le défi du jour d'un invité. « already » : déjà joué sur ce navigateur ; « limit » : trop d'invités sur cette connexion. */
export function startGuestDaily(day: string, guestId: string, home: string | null, level: Level, ip: string): "ok" | "already" | "limit" {
  if (db.prepare("SELECT 1 FROM daily_guest_results WHERE day = ? AND guest_id = ?").get(day, guestId)) return "already";
  const fp = guestFp(ip);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM daily_guest_results WHERE day = ? AND fp = ?").get(day, fp) as { n: number };
  if (n >= GUEST_PER_CONNECTION) return "limit";
  db.prepare("INSERT OR IGNORE INTO daily_guest_results (day, guest_id, name, home, level, fp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(day, guestId, guestDisplayName(guestId, home), home, level, fp, now());
  return "ok";
}
export function saveGuestDaily(day: string, guestId: string, points: number, accuracy: number, elapsedMs: number, grid: number[]) {
  const res = db.prepare("UPDATE daily_guest_results SET points = ?, accuracy = ?, elapsed_ms = ?, grid = ?, finished = 1 WHERE day = ? AND guest_id = ? AND finished = 0")
    .run(points, accuracy, elapsedMs, grid.join(""), day, guestId);
  return res.changes ? rankOfWho(day, "g" + guestId) : null;
}
/** Un invité crée son compte (ou se connecte) : tous ses défis passent sous son pseudo, sauf les jours où le compte a déjà joué. */
export function adoptGuest(guestId: string, userId: number): number {
  const rows = db.prepare("SELECT * FROM daily_guest_results WHERE guest_id = ? AND finished = 1").all(guestId) as { day: string; level: Level; points: number; accuracy: number; elapsed_ms: number; grid: string; created_at: number }[];
  let moved = 0;
  for (const r of rows) {
    const ins = db.prepare("INSERT OR IGNORE INTO daily_results (day, user_id, level, points, accuracy, elapsed_ms, grid, finished, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)")
      .run(r.day, userId, r.level, r.points, r.accuracy, r.elapsed_ms, r.grid, r.created_at);
    moved += Number(ins.changes);
  }
  db.prepare("DELETE FROM daily_guest_results WHERE guest_id = ?").run(guestId);
  return moved;
}
// Les empreintes de connexion ne servent que le jour même.
setInterval(() => { db.prepare("UPDATE daily_guest_results SET fp = NULL WHERE substr(day, -10) < ? AND fp IS NOT NULL").run(today()); }, 3_600_000).unref();

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

/** Rang dans le classement de son niveau (comptes et invités ensemble). */
export function rankOf(day: string, userId: number) { return rankOfWho(day, "u" + userId); }
function rankOfWho(day: string, who: string): { rank: number; players: number; level: Level } | null {
  const me = db.prepare("SELECT level, points, elapsed_ms FROM daily_all WHERE day = ? AND who = ? AND finished = 1").get(day, who) as { level: Level; points: number; elapsed_ms: number } | undefined;
  if (!me) return null;
  const { better } = db.prepare(
    "SELECT COUNT(*) AS better FROM daily_all WHERE day = ? AND level = ? AND finished = 1 AND (points > ? OR (points = ? AND elapsed_ms < ?))",
  ).get(day, me.level, me.points, me.points, me.elapsed_ms) as { better: number };
  const { players } = db.prepare("SELECT COUNT(*) AS players FROM daily_all WHERE day = ? AND level = ? AND finished = 1").get(day, me.level) as { players: number };
  return { rank: better + 1, players, level: me.level };
}

/** Classement d'un niveau ; le nombre de joueurs de chaque niveau, pour les onglets. */
export function leaderboard(day: string, level: Level = "normal", limit = 50) {
  const top = db.prepare(
    `SELECT name, home, points, accuracy, elapsed_ms AS elapsedMs, grid, guest FROM daily_all
     WHERE day = ? AND level = ? AND finished = 1 ORDER BY points DESC, elapsed_ms ASC LIMIT ?`,
  ).all(day, level, limit);
  const counts = Object.fromEntries((db.prepare("SELECT level, COUNT(*) AS n FROM daily_all WHERE day = ? AND finished = 1 GROUP BY level").all(day) as { level: string; n: number }[]).map((r) => [r.level, r.n]));
  // Fierté régionale : moyenne par département de cœur (au moins 3 joueurs), dans le même niveau.
  const departements = (db.prepare(
    `SELECT home AS code, COUNT(*) AS players, ROUND(AVG(points)) AS avg
     FROM daily_all WHERE day = ? AND level = ? AND finished = 1 AND home IS NOT NULL GROUP BY home HAVING COUNT(*) >= 3
     ORDER BY avg DESC LIMIT 20`,
  ).all(day, level) as { code: string; players: number; avg: number }[]).map((r) => ({ ...r, nom: DEP.get(r.code)?.nom ?? r.code }));
  return { day: dayOfKey(day), number: dailyNumber(dayOfKey(day)), level, counts, top, departements };
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
