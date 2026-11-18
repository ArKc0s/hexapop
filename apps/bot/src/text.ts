// Fonctions pures du bot (testées) : heure de Paris, textes des messages, question du jour.
import { createHash } from "node:crypto";
import { DEPARTEMENTS, LEVEL_NAMES, LEVELS, REGIONS, rng, shuffle, withArticle, type Level } from "@hexa/game";
import type { Board, Row } from "./hexa.ts";

/** Jour (AAAA-MM-JJ) et heure à Paris. */
export function paris(t = Date.now()): { day: string; hour: number; minute: number } {
  const p = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(t);
  const v = (k: string) => p.find((x) => x.type === k)?.value ?? "0";
  return { day: `${v("year")}-${v("month")}-${v("day")}`, hour: Number(v("hour")), minute: Number(v("minute")) };
}
export const yesterday = (day: string) => new Date(Date.parse(`${day}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

const MEDALS = ["🥇", "🥈", "🥉"];
const pts = (n: number) => n.toLocaleString("fr-FR").replace(/ | /g, " ");
/** « 🥇 Léo · 4 299 pts (95 s) » : les 3 premiers d'un classement. */
export function podiumLines(top: Row[], n = 3): string {
  if (!top.length) return "_personne pour l'instant_";
  return top.slice(0, n).map((r, i) => `${MEDALS[i] ?? `${i + 1}.`} **${r.name}** · ${pts(r.points)} pts (${Math.round(r.elapsedMs / 1000)} s)`).join("\n");
}
/** Un champ d'embed par niveau : podium et nombre de joueurs. */
export function podiumFields(boards: Board[]) {
  return boards.map((b) => {
    const n = b.counts[b.level] ?? 0;
    return { name: `${LEVEL_NAMES[b.level]} · ${n} joueur${n > 1 ? "s" : ""}`, value: podiumLines(b.top), inline: false };
  });
}
export { LEVELS, LEVEL_NAMES };
export type { Level };

// ---------- question du jour ----------
export interface DailyQuestion { question: string; answer: string; options: string[]; detail: string }
/** Une question par jour, la même pour tout le serveur (graine = la date), tirée parmi quatre formes. */
export function questionOf(day: string): DailyQuestion {
  // Graine bien mélangée (deux jours voisins n'ont rien en commun) ; le type de question tourne d'un jour à l'autre.
  const r = rng(createHash("sha256").update(`hexa-question|${day}`).digest().readUInt32LE(0));
  const deps = DEPARTEMENTS.filter((d) => !d.outreMer);
  const d = deps[Math.floor(r() * deps.length)];
  const dayIndex = Math.round(Date.parse(`${day}T12:00:00Z`) / 86_400_000);
  const others = (pick: (x: typeof d) => string, pool = DEPARTEMENTS) => shuffle(pool.filter((x) => pick(x) !== pick(d)), r).slice(0, 3).map(pick);
  const kind = ((dayIndex % 4) + 4) % 4;
  const de = withArticle(d).replace(/^le /, "du ").replace(/^les /, "des ").replace(/^la /, "de la ").replace(/^l'/, "de l'");
  const deName = de === withArticle(d) ? `de ${d.nom}` : de;
  const region = REGIONS.find((x) => x.code === d.region)!;
  const finish = (question: string, answer: string, wrong: string[], detail: string): DailyQuestion =>
    ({ question, answer, options: shuffle([answer, ...wrong], r), detail });
  if (kind === 0) return finish(`Quelle est la préfecture ${deName} ?`, d.prefecture, others((x) => x.prefecture), `${d.nom} (${d.code}), préfecture ${d.prefecture}.`);
  if (kind === 1) return finish(`Quel département porte le numéro ${d.code} ?`, d.nom, others((x) => x.nom), `Le ${d.code}, c'est ${withArticle(d)}, préfecture ${d.prefecture}.`);
  if (kind === 2) return finish(`${d.prefecture} est la préfecture de quel département ?`, d.nom, others((x) => x.nom, deps.filter((x) => x.region === d.region || r() < 0.3)), `${d.prefecture} est la préfecture ${deName} (${d.code}).`);
  const wrongRegions = shuffle(REGIONS.filter((x) => x.code !== region.code && DEPARTEMENTS.some((y) => y.region === x.code && !y.outreMer)), r).slice(0, 3).map((x) => x.nom);
  return finish(`Dans quelle région se trouve ${withArticle(d)} (${d.code}) ?`, region.nom, wrongRegions, `${d.nom} (${d.code}) est en ${region.nom}, chef-lieu ${region.chefLieu}.`);
}

// ---------- GitHub ----------
/** Corps d'une issue créée depuis un fil Discord : le texte, le lien du fil, sans nom d'utilisateur (le dépôt est public). */
export function issueBody(text: string, threadUrl: string, tags: string[]): string {
  return [text.trim() || "_(voir le fil sur Discord)_", "", "---", `Signalé sur le Discord d'Hexa${tags.length ? ` · ${tags.join(", ")}` : ""} : ${threadUrl}`].join("\n");
}
