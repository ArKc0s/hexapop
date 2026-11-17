// Statistiques de fréquentation, anonymes et agrégées par jour (aucun cookie, aucune donnée personnelle gardée).
// Visiteurs uniques : empreinte du jour = HMAC(secret, jour + IP + navigateur), jamais réversible, effacée le
// lendemain (même méthode que les outils d'audience respectueux de la vie privée). Le reste : de simples compteurs.
// Lu par Grafana (plugin Infinity) via GET /api/admin/stats, protégé par STATS_TOKEN. Voir docs/monitoring.md.
import { createHmac } from "node:crypto";
import { config } from "./config.ts";
import { db, now } from "./db.ts";
import { today } from "./daily.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS stats_daily (day TEXT NOT NULL, metric TEXT NOT NULL, value INTEGER NOT NULL, PRIMARY KEY (day, metric));
CREATE TABLE IF NOT EXISTS stats_visitors (day TEXT NOT NULL, h TEXT NOT NULL, app INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, h));
`);

/** Événements que le jeu peut signaler (le reste est compté par le serveur lui-même). */
export const CLIENT_EVENTS = new Set(["seance", "entrainement", "marathon", "revision"]);

export function bump(metric: string, by = 1, day = today()) {
  db.prepare("INSERT INTO stats_daily (day, metric, value) VALUES (?, ?, ?) ON CONFLICT(day, metric) DO UPDATE SET value = value + excluded.value").run(day, metric, by);
}
/** Garde le maximum du jour (ex. joueurs connectés en même temps). */
export function peak(metric: string, value: number, day = today()) {
  db.prepare("INSERT INTO stats_daily (day, metric, value) VALUES (?, ?, ?) ON CONFLICT(day, metric) DO UPDATE SET value = MAX(value, excluded.value)").run(day, metric, value);
}

/** Une visite : empreinte anonyme du jour, pour compter les visiteurs uniques sans les reconnaître d'un jour à l'autre. */
export function visit(ip: string, ua: string, app: boolean) {
  const day = today();
  const h = createHmac("sha256", config.dailySecret).update(`${day}|${ip}|${ua}`).digest("base64url").slice(0, 16);
  db.prepare("INSERT INTO stats_visitors (day, h, app) VALUES (?, ?, ?) ON CONFLICT(day, h) DO UPDATE SET app = MAX(app, excluded.app)").run(day, h, app ? 1 : 0);
  bump("visites", 1, day);
}

/** Les empreintes ne servent que le jour même : on n'en garde que le nombre, puis on les efface. */
function rollup() {
  const day = today();
  const old = db.prepare("SELECT day, COUNT(*) AS n, SUM(app) AS app FROM stats_visitors WHERE day < ? GROUP BY day").all(day) as { day: string; n: number; app: number }[];
  for (const r of old) {
    db.prepare("INSERT INTO stats_daily (day, metric, value) VALUES (?, 'visiteurs', ?), (?, 'visiteurs_appli', ?) ON CONFLICT(day, metric) DO UPDATE SET value = excluded.value").run(r.day, r.n, r.day, r.app);
  }
  db.prepare("DELETE FROM stats_visitors WHERE day < ?").run(day);
}
rollup();
setInterval(rollup, 3_600_000).unref();

/** Séries par jour pour Grafana : une ligne par jour, une colonne par mesure, et la liste des comptes. */
export function report(days: number) {
  const from = new Date(Date.now() - (days - 1) * 86_400_000);
  const since = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(from);
  const rows = db.prepare("SELECT day, metric, value FROM stats_daily WHERE day >= ? ORDER BY day").all(since) as { day: string; metric: string; value: number }[];
  const live = db.prepare("SELECT day, COUNT(*) AS n, SUM(app) AS app FROM stats_visitors GROUP BY day").all() as { day: string; n: number; app: number }[];
  const accounts = db.prepare("SELECT date(created_at / 1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS n FROM users GROUP BY day").all() as { day: string; n: number }[];
  const daily = db.prepare("SELECT day, level, COUNT(*) AS n FROM daily_results WHERE finished = 1 AND day >= ? AND day NOT LIKE '%:%' GROUP BY day, level").all(since) as { day: string; level: string; n: number }[];
  const byDay = new Map<string, Record<string, number | string>>();
  for (let t = from.getTime(); t <= Date.now(); t += 86_400_000) {
    const d = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date(t));
    byDay.set(d, { day: d, time: `${d}T12:00:00Z`, visiteurs: 0, visiteurs_appli: 0, visites: 0, seance: 0, entrainement: 0, marathon: 0, revision: 0, defi_invite: 0, defi_decouverte: 0, defi_normal: 0, defi_expert: 0, defi_regions: 0, salon_duel: 0, salon_plateau: 0, salon_coop: 0, joueurs_max: 0, nouveaux_comptes: 0 });
  }
  const set = (day: string, k: string, v: number) => { const r = byDay.get(day); if (r) r[k] = v; };
  for (const r of rows) set(r.day, r.metric, r.value);
  for (const r of live) { set(r.day, "visiteurs", r.n); set(r.day, "visiteurs_appli", r.app); }
  for (const r of accounts) set(r.day, "nouveaux_comptes", r.n);
  for (const r of daily) set(r.day, `defi_${r.level}`, r.n);
  // Défis des autres atlas (clé « regions:AAAA-MM-JJ ») : un total par atlas et par jour.
  const others = db.prepare("SELECT substr(day, 1, instr(day, ':') - 1) AS atlas, substr(day, -10) AS d, COUNT(*) AS n FROM daily_results WHERE finished = 1 AND day LIKE '%:%' AND substr(day, -10) >= ? GROUP BY atlas, d").all(since) as { atlas: string; d: string; n: number }[];
  for (const r of others) set(r.d, `defi_${r.atlas}`, r.n);
  const users = db.prepare(
    `SELECT u.pseudo, u.home_dep AS dep, u.email_verified AS verifie, datetime(u.created_at / 1000, 'unixepoch', 'localtime') AS inscrit,
       datetime(u.last_seen_at / 1000, 'unixepoch', 'localtime') AS vu, COALESCE((SELECT group_concat(provider) FROM oauth_identities o WHERE o.user_id = u.id), 'email') AS connexion,
       (SELECT COUNT(*) FROM daily_results d WHERE d.user_id = u.id AND d.finished = 1) AS defis
     FROM users u ORDER BY u.created_at DESC`,
  ).all();
  const totals = {
    comptes: (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n,
    appareils_rappels: (db.prepare("SELECT COUNT(*) AS n FROM push_subs").get() as { n: number }).n,
    marathons_hof: (db.prepare("SELECT COUNT(*) AS n FROM marathon_results").get() as { n: number }).n,
  };
  return { generatedAt: new Date(now()).toISOString(), days: [...byDay.values()], users, totals };
}
