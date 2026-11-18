// Résultat partagé du défi du jour : une page publique (hexapop.app/d/<id>) avec le score, la grille et, repliées,
// les réponses données à chaque question (« pour shamer ce que j'ai répondu », Mathis). Les 10 départements sont les
// mêmes pour tous ce jour-là : les réponses restent cachées derrière un avertissement tant que le défi est en cours.
// Créé par le serveur à la fin du défi, à partir de ce qu'il a lui-même noté : on ne peut pas inventer un résultat.
import { randomBytes } from "node:crypto";
import { ATLASES, dep, isDepartement, LEVEL_NAMES, shortCode, type AtlasId, type Answer, type Field, type Level, type Question, type RoundResult } from "@hexa/game";
import { db, now } from "./db.ts";
import { dailyNumber, dayOfKey, today } from "./daily.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS daily_shares (id TEXT PRIMARY KEY, day TEXT NOT NULL, who TEXT, created_at INTEGER NOT NULL, data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS daily_shares_who ON daily_shares (day, who);
`);

interface ShareField { field: Field; score: number; given: string | string[]; expected: string | string[] }
interface ShareData {
  name: string; level: Level; number: number; points: number; elapsedMs: number; grid: number[];
  rank?: number; players?: number; atlas?: string;
  rounds: { code: string; hint: Question["hint"]; fields: ShareField[] }[];
}
const KEEP_MS = 90 * 86_400_000;

/** Enregistre le résultat d'un défi terminé ; un seul par joueur et par jour (on renvoie le même lien). */
export function createShare(day: string, who: string | null, d: { name: string; level: Level; points: number; elapsedMs: number; grid: number[]; rank?: number; players?: number }, questions: Question[], answers: (Answer | undefined)[], results: (RoundResult | undefined)[]): string {
  if (who) {
    const old = db.prepare("SELECT id FROM daily_shares WHERE day = ? AND who = ?").get(day, who) as { id: string } | undefined;
    if (old) return old.id;
  }
  const rounds = questions.map((q, i) => ({
    code: q.code, hint: q.hint,
    fields: q.fields.map((f) => {
      const r = results[i]?.fields.find((x) => x.field === f);
      const a = answers[i] ?? {};
      return { field: f, score: r?.score ?? 0, given: (a as Record<string, string | string[] | undefined>)[f] ?? "", expected: r?.expected ?? "" };
    }),
  }));
  const atlas = day.includes(":") ? day.slice(0, day.indexOf(":")) : undefined;
  const data: ShareData = { ...d, number: dailyNumber(dayOfKey(day)), rounds, ...(atlas ? { atlas } : {}) };
  const id = randomBytes(6).toString("base64url");
  db.prepare("INSERT INTO daily_shares (id, day, who, created_at, data) VALUES (?, ?, ?, ?, ?)").run(id, day, who, now(), JSON.stringify(data));
  db.prepare("DELETE FROM daily_shares WHERE created_at < ?").run(now() - KEEP_MS);
  return id;
}

export function shareOf(day: string, who: string): string | null {
  return (db.prepare("SELECT id FROM daily_shares WHERE day = ? AND who = ?").get(day, who) as { id: string } | undefined)?.id ?? null;
}

// ---------- la page ----------
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const LABEL: Record<Field, string> = { carte: "Sur la carte", nom: "Nom", numero: "Numéro", prefecture: "Préfecture", sousPrefectures: "Sous-préfectures", limitrophes: "Voisins", drapeau: "Drapeau" };
const HINT: Record<Question["hint"], string> = { nom: "On lui donnait le nom", numero: "On lui donnait le numéro", prefecture: "On lui donnait la préfecture", carte: "Il clignotait sur la carte", drapeau: "On lui donnait le drapeau" };
/** « Finistère (29) » pour un département, le nom seul ailleurs (région, pays). */
const named = (code: string) => { const d = dep(code); return isDepartement(code) ? `${d.nom} (${code})` : d.nom; };
const MARK = ["✗", "~", "✓"];
const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const value = (f: Field, v: string | string[]) => {
  if (Array.isArray(v)) return v.length ? v.map((x) => (f === "limitrophes" ? named(x) : x)).join(", ") : "rien";
  if (!v) return "rien";
  // Carte et drapeau : la réponse est un code ; le drapeau se dit « celui du Pérou ».
  if (f === "carte") return named(v);
  if (f === "drapeau") return `celui ${withDe(v)}`;
  return v;
};

/** « du Pérou », « de la France », « des Fidji », « d'Israël ». */
function withDe(code: string): string {
  const d = dep(code);
  if (d.article === "le") return `du ${d.nom}`;
  if (d.article === "les") return `des ${d.nom}`;
  if (d.article === "la") return `de la ${d.nom}`;
  if (d.article === "l'") return `de l'${d.nom}`;
  return /^[aeiouyéèêâîôûœh]/i.test(d.nom) ? `d'${d.nom}` : `de ${d.nom}`;
}
const empty = (v: string | string[]) => (Array.isArray(v) ? v.length === 0 : !v);

export function sharePage(id: string): string | null {
  const row = db.prepare("SELECT day, data FROM daily_shares WHERE id = ?").get(id) as { day: string; data: string } | undefined;
  if (!row) return null;
  const s = JSON.parse(row.data) as ShareData;
  const realDay = dayOfKey(row.day);
  const live = realDay >= today();
  const atlasName = s.atlas ? ` · ${ATLASES[s.atlas as AtlasId]?.nom ?? s.atlas}` : "";
  const ok = s.grid.filter((g) => g === 2).length, mid = s.grid.filter((g) => g === 1).length, ko = s.grid.filter((g) => g === 0).length;
  const sec = Math.round(s.elapsedMs / 1000);
  const title = `${s.name} : ${s.points.toLocaleString("fr-FR")} points au défi Hexa n° ${s.number}`;
  const desc = `${ok} juste${ok > 1 ? "s" : ""}, ${mid} à moitié, ${ko} raté${ko > 1 ? "s" : ""} en ${LEVEL_NAMES[s.level]}${s.rank ? ` · ${s.rank}${s.rank === 1 ? "er" : "e"} sur ${s.players}` : ""}. À toi de faire mieux !`;
  const A = s.atlas && s.atlas in ATLASES ? ATLASES[s.atlas as AtlasId] : null;
  const labels = A?.labels ?? LABEL;
  const rounds = s.rounds.map((r, i) => {
    const g = s.grid[i] ?? 0;
    const fields = r.fields.map((f) => {
      const good = f.score >= 0.999;
      return `<li class="${good ? "ok" : "ko"}"><span class="l">${labels[f.field]}</span><span class="v">${good ? esc(value(f.field, f.given)) : `${empty(f.given) ? `<span class="none">pas répondu</span>` : `<s>${esc(value(f.field, f.given))}</s>`} → <b class="fix">${esc(value(f.field, f.expected))}</b>`}</span></li>`;
    }).join("");
    return `<li class="round g${g}"><div class="rh"><i class="m">${MARK[g]}</i><b>${esc(named(r.code))}</b><span>${HINT[r.hint]}</span></div><ul>${fields}</ul></li>`;
  }).join("");
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website"><meta property="og:site_name" content="Hexa">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="https://hexapop.app/og.png"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/seo/seo.css">
<style>
.res { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.card { background: #fff; border-radius: 24px; padding: 20px; text-align: center; }
.k { color: var(--soft); font-weight: 700; }
.score { font-family: Bowlby, Gabarito, sans-serif; font-size: 64px; line-height: 1; color: var(--ink); text-shadow: 4px 4px 0 var(--pink); margin: 10px 0 4px; }
.grid { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin: 12px 0; }
.grid i { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; color: #fff; font-style: normal; font-weight: 900; }
.g2 .m, .grid .g2 { background: #22b07d; } .g1 .m, .grid .g1 { background: #ffd93d; color: #1c1a37; } .g0 .m, .grid .g0 { background: #ff4fae; }
.legend { font-size: 14px; color: var(--soft); }
.go { display: flex; flex-direction: column; align-items: center; gap: 6px; }
details { background: #fff; border-radius: 24px; padding: 14px 18px; }
summary { cursor: pointer; font-weight: 800; }
summary small { display: block; color: var(--soft); font-weight: 600; }
.rounds { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.round { border-top: 2px solid var(--bg); padding-top: 10px; }
.rh { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.rh span { color: var(--soft); font-size: 14px; }
.m { width: 24px; height: 24px; border-radius: 8px; display: inline-grid; place-items: center; color: #fff; font-style: normal; font-weight: 900; font-size: 14px; }
.round ul { list-style: none; margin: 6px 0 0 32px; padding: 0; font-size: 15px; }
.round ul li { display: flex; gap: 10px; align-items: baseline; }
.l { color: var(--soft); flex: none; width: 118px; }
.none { color: var(--soft); font-style: italic; font-weight: 600; }
.ok .v { color: #16825b; font-weight: 800; }
.ko s { color: #cf2486; text-decoration-thickness: 2px; }
.fix { color: #0d4f8c; }
</style></head>
<body>
<header class="top"><a class="logo" href="/">HEXA</a><nav></nav><a class="play" href="/#defi">Jouer le défi du jour</a></header>
<main class="res">
  <div class="card">
    <span class="k">Défi du jour n° ${s.number}${atlasName} · ${LEVEL_NAMES[s.level]} · ${fmtDay(realDay)}</span>
    <h1>${esc(s.name)}</h1>
    <div class="score">${s.points.toLocaleString("fr-FR")}</div>
    <span class="k">points · ${sec} s${s.rank ? ` · ${s.rank}${s.rank === 1 ? "er" : "e"} sur ${s.players}` : ""}</span>
    <div class="grid">${s.grid.map((g) => `<i class="g${g}">${MARK[g]}</i>`).join("")}</div>
    <p class="legend">✓ juste · ~ à moitié · ✗ raté (une case par ${A?.un ?? "département"})</p>
    <div class="go"><a class="btn" href="/#defi">${live ? "Fais mieux : joue le défi du jour" : "Joue le défi d'aujourd'hui"}</a><span class="legend">Gratuit, sans inscription, 2 minutes.</span></div>
  </div>
  <details${live ? "" : " open"}>
    <summary>Voir ses réponses${live ? `<small>Attention : ça dévoile les ${A?.des ?? "départements"} du défi d'aujourd'hui. Joue d'abord !</small>` : ""}</summary>
    <ol class="rounds">${rounds}</ol>
  </details>
</main>
</body></html>`;
}
