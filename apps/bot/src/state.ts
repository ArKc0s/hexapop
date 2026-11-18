// Ce que le bot doit retenir d'un redémarrage à l'autre (déploiements) : un petit fichier JSON dans le volume /data.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.ts";

export interface Question { day: string; channel: string; message: string; answer: string; question: string; options: string[]; answers: Record<string, { ok: boolean; at: number }>; first?: string }
export interface State {
  /** Jour (AAAA-MM-JJ) déjà annoncé : défi du matin, podium du soir, question du jour. */
  defiPosted?: string; podiumPosted?: string;
  question?: Question;
  /** Dernière entrée de la page Nouveautés publiée. */
  newsId?: number;
  /** Message épinglé de la roadmap et empreinte de son texte. */
  roadmap?: { message: string; hash: string };
  /** Fils des forums #bugs / #idées → issue GitHub. */
  issues: Record<string, { number: number; url: string; closed?: boolean; lastComment?: number; /** Premier message du fil (déjà le corps de l'issue). */ starter?: string }>;
  /** Les issues ouvertes sur GitHub après cette date deviennent des fils (pas l'historique). */
  ghSince?: string;
  /** Soirées publiques annoncées : code → message et dernier état vu. */
  soirees: Record<string, { message: string; phase: string; pinged: number }>;
}

let data: State = { issues: {}, soirees: {} };
try { data = { issues: {}, soirees: {}, ...JSON.parse(readFileSync(config.state, "utf8")) }; } catch { /* premier lancement */ }

export const state = data;
export function save() {
  mkdirSync(dirname(config.state), { recursive: true });
  const tmp = config.state + ".tmp";
  writeFileSync(tmp, JSON.stringify(data, null, 1));
  renameSync(tmp, config.state);
}
