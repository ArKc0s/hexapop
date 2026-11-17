// Statistiques en direct : qui est là maintenant, sur quel écran, et les salons en cours.
// Présence : chaque onglet ouvert envoie toutes les minutes l'écran où il est, avec un identifiant tiré au hasard
// au chargement de la page (ni cookie, ni IP gardée, rien d'écrit sur disque) ; oublié après 2 minutes sans nouvelles.
// Les salons (multi, défi du jour) viennent directement du serveur de jeu.
// Une mesure par minute est gardée 14 jours (table stats_live) pour les courbes Grafana. Voir docs/monitoring.md.
import { db, now } from "./db.ts";
import { liveRooms } from "./rooms.ts";
import { life } from "./life.ts";

db.exec("CREATE TABLE IF NOT EXISTS stats_live (ts INTEGER NOT NULL, metric TEXT NOT NULL, value INTEGER NOT NULL, PRIMARY KEY (ts, metric))");

/** Écrans signalés par le jeu. */
export const SCREENS = new Set(["accueil", "seance", "entrainement", "marathon", "revision", "defi", "multi", "autre"]);
const TTL = 120_000;
const present = new Map<string, { s: string; at: number }>();

export function ping(id: string, screen: string) {
  if (!/^[\w-]{8,64}$/.test(id) || !SCREENS.has(screen)) return;
  if (present.size > 50_000 && !present.has(id)) return;
  present.set(id, { s: screen, at: now() });
}

/** Instantané : une ligne à plat (pratique pour les tuiles Grafana). */
export function liveNow() {
  const t = now();
  const ecrans: Record<string, number> = Object.fromEntries([...SCREENS].map((s) => [s, 0]));
  for (const [id, p] of present) {
    if (t - p.at > TTL) { present.delete(id); continue; }
    ecrans[p.s]++;
  }
  const rooms = liveRooms();
  const flat: Record<string, number> = {
    en_ligne: present.size,
    solo: ecrans.seance + ecrans.entrainement + ecrans.marathon + ecrans.revision,
    ...Object.fromEntries(Object.entries(ecrans).map(([k, v]) => [`ecran_${k}`, v])),
  };
  for (const [kind, r] of Object.entries(rooms)) {
    flat[`${kind}_salons`] = r.salons; flat[`${kind}_en_partie`] = r.en_partie; flat[`${kind}_joueurs`] = r.joueurs; flat[`${kind}_spectateurs`] = r.spectateurs;
  }
  flat.multi_joueurs = rooms.duel.joueurs + rooms.plateau.joueurs + rooms.coop.joueurs;
  return flat;
}

const KEEP = ["en_ligne", "solo", "ecran_accueil", "ecran_seance", "ecran_entrainement", "ecran_marathon", "ecran_revision", "defi_en_partie", "multi_joueurs", "duel_en_partie", "plateau_en_partie", "coop_en_partie", "daily_joueurs"];
function sample() {
  if (life.draining) return;
  const ts = Math.floor(now() / 60_000) * 60_000;
  const n = liveNow();
  n.defi_en_partie = n.daily_en_partie;
  const ins = db.prepare("INSERT OR REPLACE INTO stats_live (ts, metric, value) VALUES (?, ?, ?)");
  for (const k of KEEP) ins.run(ts, k, n[k] ?? 0);
  db.prepare("DELETE FROM stats_live WHERE ts < ?").run(ts - 14 * 86_400_000);
}
setInterval(sample, 60_000).unref();

/** Pour Grafana : l'instantané et une ligne par minute sur les dernières heures. */
export function liveReport(hours: number) {
  const since = now() - hours * 3_600_000;
  const rows = db.prepare("SELECT ts, metric, value FROM stats_live WHERE ts >= ? ORDER BY ts").all(since) as { ts: number; metric: string; value: number }[];
  const byTs = new Map<number, Record<string, number | string>>();
  for (const r of rows) {
    let o = byTs.get(r.ts);
    if (!o) { o = { time: new Date(r.ts).toISOString(), ...Object.fromEntries(KEEP.map((k) => [k, 0])) }; byTs.set(r.ts, o); }
    o[r.metric] = r.value;
  }
  return { now: [{ time: new Date(now()).toISOString(), ...liveNow() }], series: [...byTs.values()] };
}
