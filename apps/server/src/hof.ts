// Hall of Fame (conception 4.6), pour les comptes connectés :
// - défi du jour : classements de la semaine et du mois, par niveau (somme des points) ;
// - Marathon : meilleur résultat sur les 101 en fiche complète, au clavier (justesse d'abord, temps ensuite) ;
// - Légendes : les premiers à avoir toute la France en bronze (100 % de « Ta France »), puis en argent, puis en or.
import { LEVELS, sanitizeProfile, type AtlasId, type Level } from "@hexa/game";
import { db, now } from "./db.ts";
import { today } from "./daily.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS marathon_results (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  accuracy REAL NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS marathon_rank ON marathon_results(accuracy DESC, elapsed_ms ASC);
`);

/** Premier jour de la semaine (lundi) et du mois, au format du défi (heure de Paris). */
export function periodStarts(day = today()): { week: string; month: string } {
  const d = new Date(`${day}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7; // lundi = 0
  const monday = new Date(d.getTime() - back * 86_400_000).toISOString().slice(0, 10);
  return { week: monday, month: `${day.slice(0, 7)}-01` };
}

/** Défis d'un atlas depuis une date (départements : « 2026-11-17 » ; autres : « regions:2026-11-17 »). */
function dailyBoard(from: string, level: Level, atlas: AtlasId, limit = 10) {
  const fr = atlas === "france";
  return db.prepare(
    `SELECT u.pseudo AS name, u.home_dep AS home, SUM(d.points) AS points, COUNT(*) AS days
     FROM daily_results d JOIN users u ON u.id = d.user_id
     WHERE d.day >= ? AND ${fr ? "d.day NOT LIKE '%:%'" : "d.day LIKE ?"} AND d.level = ? AND d.finished = 1
     GROUP BY d.user_id ORDER BY points DESC, days ASC LIMIT ?`,
  ).all(...(fr ? [from, level, limit] : [`${atlas}:${from}`, `${atlas}:%`, level, limit])) as { name: string; home: string | null; points: number; days: number }[];
}

/** Garde le meilleur Marathon d'un joueur. Renvoie son record et son rang. */
export function saveMarathon(userId: number, accuracy: number, elapsedMs: number) {
  const prev = db.prepare("SELECT accuracy, elapsed_ms FROM marathon_results WHERE user_id = ?").get(userId) as { accuracy: number; elapsed_ms: number } | undefined;
  const better = !prev || accuracy > prev.accuracy || (accuracy === prev.accuracy && elapsedMs < prev.elapsed_ms);
  if (better) {
    db.prepare("INSERT INTO marathon_results (user_id, accuracy, elapsed_ms, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET accuracy = excluded.accuracy, elapsed_ms = excluded.elapsed_ms, created_at = excluded.created_at")
      .run(userId, accuracy, elapsedMs, now());
  }
  const best = better ? { accuracy, elapsed_ms: elapsedMs } : prev!;
  const { above } = db.prepare("SELECT COUNT(*) AS above FROM marathon_results WHERE accuracy > ? OR (accuracy = ? AND elapsed_ms < ?)")
    .get(best.accuracy, best.accuracy, best.elapsed_ms) as { above: number };
  const { players } = db.prepare("SELECT COUNT(*) AS players FROM marathon_results").get() as { players: number };
  return { record: better, best: { accuracy: best.accuracy, elapsedMs: best.elapsed_ms }, rank: above + 1, players };
}

const LEGENDS = { france: "album-101", argent: "argent-101", or: "or-101" } as const;
/** Légendes d'un autre atlas : mêmes trois paliers, ses propres succès. */
const LEGENDS_OF: Record<AtlasId, Record<keyof typeof LEGENDS, string>> = {
  france: LEGENDS,
  regions: { france: "regions-18", argent: "regions-argent", or: "regions-or" },
};
type LegendRow = { name: string; home: string | null; at: number };
const legendsCache = new Map<AtlasId, { at: number; data: Record<keyof typeof LEGENDS, LegendRow[]> }>();

/** Légendes : lues dans les profils (date du succès), recalculées au plus une fois par minute. */
function legends(atlas: AtlasId): Record<keyof typeof LEGENDS, LegendRow[]> {
  const hit = legendsCache.get(atlas);
  if (hit && now() - hit.at < 60_000) return hit.data;
  const rows = db.prepare("SELECT u.pseudo AS name, u.home_dep AS home, p.data FROM profiles p JOIN users u ON u.id = p.user_id").all() as { name: string; home: string | null; data: string }[];
  const data = { france: [] as LegendRow[], argent: [] as LegendRow[], or: [] as LegendRow[] };
  for (const r of rows) {
    let badges: Record<string, number> = {};
    try { badges = sanitizeProfile(JSON.parse(r.data)).badges; } catch { continue; }
    for (const [k, id] of Object.entries(LEGENDS_OF[atlas]) as [keyof typeof LEGENDS, string][]) if (badges[id]) data[k].push({ name: r.name, home: r.home, at: badges[id] });
  }
  for (const k of Object.keys(data) as (keyof typeof LEGENDS)[]) data[k] = data[k].sort((a, b) => a.at - b.at).slice(0, 50);
  legendsCache.set(atlas, { at: now(), data });
  return data;
}

export function hallOfFame(atlas: AtlasId = "france") {
  const { week, month } = periodStarts();
  const daily = {
    week: Object.fromEntries(LEVELS.map((l) => [l, dailyBoard(week, l, atlas)])),
    month: Object.fromEntries(LEVELS.map((l) => [l, dailyBoard(month, l, atlas)])),
    since: { week, month },
  };
  const marathon = db.prepare(
    `SELECT u.pseudo AS name, u.home_dep AS home, m.accuracy, m.elapsed_ms AS elapsedMs, m.created_at AS at
     FROM marathon_results m JOIN users u ON u.id = m.user_id ORDER BY m.accuracy DESC, m.elapsed_ms ASC LIMIT 20`,
  ).all();
  // Le Marathon (les 101) n'existe que pour les départements.
  return { daily, marathon: atlas === "france" ? marathon : [], legends: legends(atlas) };
}
