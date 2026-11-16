// Moteur de salons temps réel. Le serveur tire les questions, chronomètre et note :
// les clients n'envoient que leurs réponses, l'heure de réception fait foi
// (corrigée de la moitié de la latence mesurée par ping WebSocket).

import { randomBytes, randomInt } from "node:crypto";
import type { WebSocket } from "ws";
import {
  COUNTDOWN_MS, DEFAULT_SETTINGS, DUEL_HP, REACTIONS, duelDamage, DEPARTEMENTS, MAX_PLAYERS, REVIEW_MS, grade, makeGame, randomSeed,
  type Answer, type ClientMsg, type DailyOutcome, type ErrorCode, type Phase, type PlayerInfo, type Question,
  type QuestionPayload, type RoomKind, type RoomSettings, type RoundResult, type ServerMsg,
} from "@hexa/game";
import { now } from "./db.ts";
import { dailyConfig, dailyNumber, gridOf, rankOf, saveDaily, startDaily, today } from "./daily.ts";

/** Délai entre l'annonce d'une question et le départ du chrono, pour que tout le monde la reçoive. */
const LEAD_MS = 400;
/** Tolérance réseau après la fin du chrono. */
const GRACE_MS = 400;
const ROOM_TTL_MS = 15 * 60_000;

export interface Conn {
  ws: WebSocket;
  playerId: string;
  name: string;
  userId: number | null;
  home: string | null;
  rttMs: number;
  lastReact?: number;
  room: Room | null;
  spectating: boolean;
}

interface Seat {
  info: PlayerInfo;
  conn: Conn | null;
  userId: number | null;
  results: (RoundResult | undefined)[];
}

const rooms = new Map<string, Room>();
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sans I ni O
function roomCode(): string {
  for (;;) {
    let c = "";
    for (let i = 0; i < 4; i++) c += ALPHABET[randomInt(ALPHABET.length)];
    if (!rooms.has(c)) return c;
  }
}

export function send(c: Conn, msg: ServerMsg) {
  if (c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(msg));
}
export function fail(c: Conn, code: ErrorCode, message: string) {
  send(c, { t: "error", code, message });
}

function clampSettings(s: Partial<RoomSettings>, base: RoomSettings): RoomSettings {
  const regions = Array.isArray(s.regions) ? s.regions.filter((r) => typeof r === "string" && DEPARTEMENTS.some((d) => d.region === r)).slice(0, 18) : base.regions;
  return {
    level: s.level === "expert" || s.level === "normal" ? s.level : base.level,
    input: s.input === "choix" || s.input === "libre" ? s.input : base.input,
    rounds: Number.isInteger(s.rounds) ? Math.min(101, Math.max(5, s.rounds as number)) : base.rounds,
    regions,
    elimination: typeof s.elimination === "boolean" ? s.elimination : base.elimination,
  };
}

const str = (v: unknown, max = 80) => (typeof v === "string" ? v.slice(0, max) : undefined);
const strs = (v: unknown, max = 20) => (Array.isArray(v) ? v.slice(0, max).map((x) => str(x)).filter((x): x is string => !!x) : undefined);
function sanitizeAnswer(a: unknown): Omit<Answer, "elapsedMs"> {
  const o = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
  return {
    carte: str(o.carte, 4), nom: str(o.nom), numero: str(o.numero, 4), prefecture: str(o.prefecture),
    sousPrefectures: strs(o.sousPrefectures), limitrophes: strs(o.limitrophes),
  };
}

export class Room {
  code = roomCode();
  phase: Phase = "lobby";
  seats = new Map<string, Seat>();
  spectators = new Set<Conn>();
  questions: Question[] = [];
  qi = -1;
  startsAt = 0;
  endsAt = 0;
  timer: NodeJS.Timeout | null = null;
  lastActivity = now();
  day: string | null = null;
  /** Duel à points de vie : activé quand un duel démarre à exactement deux joueurs. */
  hpMode = false;

  kind: RoomKind;
  settings: RoomSettings;

  constructor(kind: RoomKind, settings: RoomSettings) {
    this.kind = kind;
    this.settings = settings;
    rooms.set(this.code, this);
  }

  // ---------- membres ----------
  get active() { return [...this.seats.values()].filter((s) => !s.info.eliminated); }

  add(c: Conn, spectate = false): ErrorCode | null {
    this.lastActivity = now();
    if (spectate) { this.spectators.add(c); c.room = this; c.spectating = true; this.broadcastRoom(); this.catchUp(c); return null; }
    const existing = this.seats.get(c.playerId);
    if (existing) {
      existing.conn = c; existing.info.connected = true; c.room = this;
      this.broadcastRoom(); this.catchUp(c);
      return null;
    }
    if (this.phase !== "lobby") return "already_started";
    if (this.seats.size >= (this.kind === "daily" ? 1 : MAX_PLAYERS)) return "room_full";
    const host = this.seats.size === 0;
    this.seats.set(c.playerId, {
      info: { id: c.playerId, name: c.name, home: c.home ?? undefined, score: 0, connected: true, eliminated: false, answered: false, host },
      conn: c, userId: c.userId, results: [],
    });
    c.room = this;
    this.broadcastRoom();
    return null;
  }

  disconnect(c: Conn) {
    if (this.spectators.delete(c)) { this.broadcastRoom(); return; }
    const seat = this.seats.get(c.playerId);
    if (!seat || seat.conn !== c) return;
    seat.conn = null;
    seat.info.connected = false;
    if (this.phase === "lobby") this.seats.delete(c.playerId);
    if (seat.info.host) this.passHost();
    this.lastActivity = now();
    this.broadcastRoom();
    this.maybeCloseRound();
  }

  leave(c: Conn) {
    this.disconnect(c);
    this.seats.delete(c.playerId);
    c.room = null;
    this.broadcastRoom();
  }

  private passHost() {
    const seats = [...this.seats.values()];
    for (const s of seats) s.info.host = false;
    const next = seats.find((s) => s.info.connected);
    if (next) next.info.host = true;
  }

  isHost(c: Conn) { return this.seats.get(c.playerId)?.info.host ?? false; }

  // ---------- diffusion ----------
  private conns(): Conn[] {
    const out: Conn[] = [];
    for (const s of this.seats.values()) if (s.conn) out.push(s.conn);
    out.push(...this.spectators);
    return out;
  }
  broadcast(msg: ServerMsg) {
    const data = JSON.stringify(msg);
    for (const c of this.conns()) if (c.ws.readyState === c.ws.OPEN) c.ws.send(data);
  }
  players(): PlayerInfo[] {
    const byHp = this.hpMode;
    return [...this.seats.values()].map((s) => s.info).sort((a, b) => (byHp ? (b.hp ?? 0) - (a.hp ?? 0) : 0) || b.score - a.score);
  }

  react(c: Conn, e: unknown) {
    const t = Date.now();
    if (typeof e !== "string" || !REACTIONS.includes(e) || (c.lastReact && t - c.lastReact < 800)) return;
    if (!this.seats.has(c.playerId) && !this.spectators.has(c)) return;
    c.lastReact = t;
    this.broadcast({ t: "react", player: c.playerId, e });
  }
  broadcastRoom() {
    this.broadcast({ t: "room", room: this.code, kind: this.kind, settings: this.settings, players: this.players(), phase: this.phase, spectators: this.spectators.size });
  }
  /** Renvoie la question en cours à quelqu'un qui (re)arrive. */
  private catchUp(c: Conn) {
    if (this.phase === "question" || this.phase === "countdown") {
      const q = this.questions[this.qi];
      if (q) send(c, { t: "question", q: this.payload(q) });
    }
  }

  // ---------- partie ----------
  updateSettings(c: Conn, s: Partial<RoomSettings>) {
    if (!this.isHost(c)) return fail(c, "not_host", "Seul l'hôte peut changer les règles.");
    if (this.phase !== "lobby") return fail(c, "already_started", "La partie a déjà commencé.");
    this.settings = clampSettings(s, this.settings);
    this.broadcastRoom();
  }

  start(c: Conn | null) {
    if (c && !this.isHost(c)) return fail(c, "not_host", "Seul l'hôte peut lancer la partie.");
    if (this.phase !== "lobby") return;
    const codes = this.settings.regions.length ? DEPARTEMENTS.filter((d) => this.settings.regions.includes(d.region)).map((d) => d.code) : undefined;
    const cfg = this.kind === "daily" && this.day
      ? dailyConfig(this.day)
      : { seed: randomSeed(), level: this.settings.level, input: this.settings.input, rounds: this.settings.rounds, codes };
    this.questions = makeGame(cfg);
    this.hpMode = this.kind === "duel" && this.seats.size === 2;
    for (const s of this.seats.values()) s.info.hp = this.hpMode ? DUEL_HP : undefined;
    this.phase = "countdown";
    this.broadcastRoom();
    this.schedule(this.kind === "daily" ? 800 : COUNTDOWN_MS, () => this.ask(0));
  }

  private schedule(ms: number, fn: () => void) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(fn, ms);
  }

  private payload(q: Question): QuestionPayload {
    return { index: q.index, total: this.questions.length, code: q.code, hint: q.hint, fields: q.fields, choices: q.choices, durationMs: q.durationMs, startsAt: this.startsAt, endsAt: this.endsAt };
  }

  private ask(i: number) {
    this.qi = i;
    const q = this.questions[i];
    this.startsAt = now() + LEAD_MS;
    this.endsAt = this.startsAt + q.durationMs;
    for (const s of this.seats.values()) s.info.answered = false;
    this.phase = "question";
    this.broadcastRoom();
    this.broadcast({ t: "question", q: this.payload(q) });
    this.schedule(this.endsAt - now() + GRACE_MS, () => this.closeRound());
  }

  answer(c: Conn, index: number, raw: unknown) {
    const seat = this.seats.get(c.playerId);
    if (!seat || seat.info.eliminated || this.phase !== "question" || index !== this.qi || seat.results[index]) return;
    const t = now();
    if (t > this.endsAt + GRACE_MS) return;
    const q = this.questions[index];
    const elapsedMs = Math.min(q.durationMs, Math.max(0, t - this.startsAt - c.rttMs / 2));
    seat.results[index] = grade(q, { ...sanitizeAnswer(raw), elapsedMs });
    seat.info.answered = true;
    this.broadcast({ t: "answered", player: seat.info.id });
    this.maybeCloseRound();
  }

  private maybeCloseRound() {
    if (this.phase !== "question") return;
    const waiting = this.active.filter((s) => s.info.connected && !s.results[this.qi]);
    if (waiting.length === 0) this.closeRound();
  }

  private closeRound() {
    if (this.phase !== "question") return;
    const q = this.questions[this.qi];
    const results: Record<string, RoundResult> = {};
    for (const s of this.active) {
      const r = s.results[this.qi];
      if (r) { results[s.info.id] = r; s.info.score += r.points; }
    }
    const eliminated = this.settings.elimination ? this.eliminate() : [];
    let damage: Record<string, number> | undefined;
    // Un joueur parti en plein duel : l'autre gagne par forfait.
    const forfeit = this.hpMode && this.seats.size < 2;
    if (this.hpMode && !forfeit) {
      const [a, b] = [...this.seats.values()];
      const pa = results[a.info.id]?.points ?? 0, pb = results[b.info.id]?.points ?? 0;
      const loser = pa < pb ? a : pb < pa ? b : null;
      if (loser) {
        const dmg = duelDamage(pa - pb, this.qi);
        loser.info.hp = Math.max(0, (loser.info.hp ?? DUEL_HP) - dmg);
        damage = { [loser.info.id]: dmg };
      }
    }
    const knockout = forfeit || (this.hpMode && [...this.seats.values()].some((s) => (s.info.hp ?? 1) <= 0));
    const last = knockout || this.qi + 1 >= this.questions.length || (this.settings.elimination && this.active.length <= 1);
    const review = this.kind === "daily" ? 0 : REVIEW_MS;
    const nextAt = last ? null : now() + review;
    this.phase = "review";
    this.broadcastRoom();
    this.broadcast({ t: "round", summary: { index: this.qi, code: q.code, results, eliminated, damage, nextAt } });
    if (this.kind === "daily") return; // le joueur passe au suivant lui-même
    this.schedule(review, () => (last ? this.finish() : this.ask(this.qi + 1)));
  }

  rematch(c: Conn) {
    if (this.kind === "daily" || this.phase !== "ended") return;
    if (!this.isHost(c)) return fail(c, "not_host", "Seul l'hôte peut relancer.");
    for (const [id, s] of this.seats) {
      if (!s.conn) { this.seats.delete(id); continue; }
      s.info.score = 0; s.info.eliminated = false; s.info.answered = false; s.info.hp = undefined; s.results = [];
    }
    this.questions = []; this.qi = -1;
    this.phase = "lobby";
    this.lastActivity = now();
    this.broadcastRoom();
  }

  /** Défi du jour : le joueur demande la question suivante après avoir lu la correction. */
  next(c: Conn) {
    if (this.kind !== "daily" || this.phase !== "review" || !this.seats.has(c.playerId)) return;
    if (this.qi + 1 >= this.questions.length) this.finish();
    else this.ask(this.qi + 1);
  }

  /** Mode plateau : à partir de la 3e manche, le dernier quart du classement sort. */
  private eliminate(): string[] {
    const alive = this.active;
    if (this.qi < 2 || alive.length <= 2) return [];
    const n = Math.max(1, Math.floor(alive.length / 4));
    const out = [...alive].sort((a, b) => a.info.score - b.info.score).slice(0, n);
    for (const s of out) s.info.eliminated = true;
    return out.map((s) => s.info.id);
  }

  private finish() {
    this.phase = "ended";
    if (this.timer) clearTimeout(this.timer);
    this.broadcastRoom();
    const ranking = this.players();
    if (this.kind === "daily" && this.day) {
      const seat = [...this.seats.values()][0];
      const results = this.questions.map((_, i) => seat?.results[i]);
      const points = seat?.info.score ?? 0;
      const accuracy = results.reduce((n, r) => n + (r?.accuracy ?? 0), 0) / this.questions.length;
      const elapsedMs = results.reduce((n, r) => n + (r?.elapsedMs ?? this.questions[0].durationMs), 0);
      const grid = gridOf(results);
      let saved = false, rank: { rank: number; players: number } | null = null;
      if (seat?.userId) {
        rank = saveDaily(this.day, seat.userId, points, accuracy, elapsedMs, grid);
        saved = !!rank;
        rank ??= rankOf(this.day, seat.userId);
      }
      const daily: DailyOutcome = { day: this.day, number: dailyNumber(this.day), points, accuracy, elapsedMs, grid, saved, rank: rank?.rank, players: rank?.players };
      this.broadcast({ t: "end", ranking, daily });
    } else {
      this.broadcast({ t: "end", ranking });
    }
    this.lastActivity = now();
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    for (const c of this.conns()) c.room = null;
    rooms.delete(this.code);
  }
}

// ---------- routage des messages ----------
export function handle(c: Conn, msg: ClientMsg) {
  switch (msg.t) {
    case "ping":
      return send(c, { t: "pong", c: msg.c, s: now() });
    case "create": {
      c.room?.leave(c);
      if (msg.kind === "daily") {
        const day = today();
        if (c.userId && !startDaily(day, c.userId)) return fail(c, "daily_done", "Tu as déjà joué le défi du jour. Rendez-vous demain !");
        const room = new Room("daily", { ...DEFAULT_SETTINGS, rounds: 10 });
        room.day = day;
        room.add(c);
        return room.start(null);
      }
      const kind: RoomKind = msg.kind === "plateau" ? "plateau" : "duel";
      const base = { ...DEFAULT_SETTINGS, elimination: kind === "plateau" };
      const room = new Room(kind, clampSettings(msg.settings ?? {}, base));
      room.add(c);
      return;
    }
    case "join": {
      const room = rooms.get(String(msg.room ?? "").toUpperCase().trim());
      if (!room || room.kind === "daily") return fail(c, "room_not_found", "Aucun salon avec ce code.");
      if (c.room && c.room !== room) c.room.leave(c);
      const err = room.add(c, !!msg.spectate);
      if (err === "already_started") return fail(c, err, "La partie a déjà commencé : rejoins en spectateur.");
      if (err === "room_full") return fail(c, err, "Le salon est plein.");
      return;
    }
    case "settings": return c.room?.updateSettings(c, msg.settings ?? {});
    case "start": return c.room?.start(c);
    case "answer": return c.room?.answer(c, Number(msg.index), msg.answer);
    case "next": return c.room?.next(c);
    case "rematch": return c.room?.rematch(c);
    case "react": return c.room?.react(c, msg.e);
    case "leave": return c.room?.leave(c);
    default: return fail(c, "bad_request", "Message inconnu.");
  }
}

export function newPlayerId() { return randomBytes(9).toString("base64url"); }

// Ménage : salons vides ou terminés depuis un moment.
setInterval(() => {
  const t = now();
  for (const r of rooms.values()) {
    const empty = ![...r.seats.values()].some((s) => s.conn) && r.spectators.size === 0;
    if ((empty || r.phase === "ended") && t - r.lastActivity > (empty ? 60_000 : ROOM_TTL_MS)) r.dispose();
  }
}, 30_000).unref();

export function stats() { return { rooms: rooms.size, players: [...rooms.values()].reduce((n, r) => n + r.seats.size, 0) }; }
