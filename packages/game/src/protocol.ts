// Protocole WebSocket entre clients (web, futur Flutter) et serveur.
// Le serveur fait foi : il tire les questions, chronomètre et note.
// Toutes les heures sont en millisecondes « horloge serveur » ; le client corrige
// avec l'écart mesuré par ping/pong (offset = serverNow - (t0 + t1) / 2).

import type { Answer, Field, Hint, InputMode, Level, RoundResult, ChoiceField } from "./round.ts";

export const PROTOCOL_VERSION = 1;

export type RoomKind = "duel" | "plateau" | "daily";

export interface RoomSettings {
  level: Level;
  input: InputMode;
  /** Nombre de tours (10 à 101). */
  rounds: number;
  /** Codes de région INSEE pour restreindre le tirage ; vide = toute la France. */
  regions: string[];
  /** Mode plateau : éliminer les derniers après chaque manche. */
  elimination: boolean;
}

export interface PlayerInfo {
  id: string;
  name: string;
  /** Département de cœur (affiché en badge). */
  home?: string;
  score: number;
  connected: boolean;
  eliminated: boolean;
  /** A répondu au tour en cours. */
  answered: boolean;
  host: boolean;
}

export interface QuestionPayload {
  index: number;
  total: number;
  /** Code du département : nécessaire pour l'indice « carte » et la fiche de correction. */
  code: string;
  hint: Hint;
  fields: Field[];
  choices?: Partial<Record<ChoiceField, string[]>>;
  durationMs: number;
  /** Début et fin du tour, horloge serveur. */
  startsAt: number;
  endsAt: number;
}

export interface RoundSummary {
  index: number;
  code: string;
  /** Résultat par joueur (absent = pas de réponse). */
  results: Record<string, RoundResult>;
  eliminated: string[];
  nextAt: number | null;
}

// ---------- client -> serveur ----------
export type ClientMsg =
  | { t: "hello"; v: number; token?: string; name?: string; room?: string; resume?: string }
  | { t: "ping"; c: number }
  | { t: "create"; kind: RoomKind; settings?: Partial<RoomSettings> }
  | { t: "join"; room: string; spectate?: boolean }
  | { t: "settings"; settings: Partial<RoomSettings> }
  | { t: "start" }
  | { t: "answer"; index: number; answer: Omit<Answer, "elapsedMs"> }
  /** Défi du jour uniquement : passer à la question suivante. */
  | { t: "next" }
  | { t: "leave" };

// ---------- serveur -> client ----------
export type ServerMsg =
  | { t: "welcome"; you: string; name: string; resume: string; serverNow: number; account: boolean }
  | { t: "pong"; c: number; s: number }
  | { t: "room"; room: string; kind: RoomKind; settings: RoomSettings; players: PlayerInfo[]; phase: Phase; spectators: number }
  | { t: "question"; q: QuestionPayload }
  | { t: "answered"; player: string }
  | { t: "round"; summary: RoundSummary }
  | { t: "end"; ranking: PlayerInfo[]; daily?: DailyOutcome }
  | { t: "error"; code: ErrorCode; message: string };

export type Phase = "lobby" | "countdown" | "question" | "review" | "ended";
export type ErrorCode = "bad_request" | "room_not_found" | "room_full" | "already_started" | "not_host" | "auth_required" | "daily_done" | "version";

export const DEFAULT_SETTINGS: RoomSettings = { level: "normal", input: "libre", rounds: 20, regions: [], elimination: false };
export const MAX_PLAYERS = 100;
export const REVIEW_MS = 5_000;
export const COUNTDOWN_MS = 3_000;

export interface DailyOutcome {
  day: string;
  number: number;
  points: number;
  accuracy: number;
  elapsedMs: number;
  /** Une case par tour : 2 = parfait, 1 = partiel, 0 = raté. */
  grid: number[];
  /** Rang du joueur (si connecté et premier essai). */
  rank?: number;
  players?: number;
  saved: boolean;
}

export const DAILY_ROUNDS = 10;
/** Jour 1 du défi quotidien. */
export const DAILY_EPOCH = "2026-11-16";
