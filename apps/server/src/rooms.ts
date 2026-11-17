// Moteur de salons temps réel. Le serveur tire les questions, chronomètre et note :
// les clients n'envoient que leurs réponses, l'heure de réception fait foi
// (corrigée de la moitié de la latence mesurée par ping WebSocket).

import { randomBytes, randomInt } from "node:crypto";
import type { WebSocket } from "ws";
import {
  COUNTDOWN_MS, DEFAULT_SETTINGS, DUEL_HP, REACTIONS, duelDamage, DEFAULT_DURATION, TEAM_LIVES, TEAM_LIFE_THRESHOLD, roomPoints, teamStars,
  type Level, type TeamState, isLevel, levelAllowed, DEPARTEMENTS, MAX_PLAYERS, REVIEW_MS, grade, makeGame, randomSeed,
  type Answer, type ClientMsg, type DailyOutcome, type ErrorCode, type Phase, type PlayerInfo, type Question,
  type QuestionPayload, type RoomKind, type RoomSettings, type RoundResult, type ServerMsg,
} from "@hexa/game";
import { now } from "./db.ts";
import { life } from "./life.ts";
import { bump } from "./stats.ts";
import { dailyConfig, dailyNumber, gridOf, newClaim, rankOf, saveDaily, startDaily, today } from "./daily.ts";

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
  /** Niveau du joueur (d'après sa carte) : niveau par défaut en salon, plafond au défi du jour. */
  level: Level;
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
/** Première lettre propre à chaque instance (bleue A-N, verte P-Z) : deux versions en ligne n'ont jamais le même code. */
const FIRST = life.color === "blue" ? ALPHABET.slice(0, 12) : life.color === "green" ? ALPHABET.slice(12) : ALPHABET;
function roomCode(): string {
  for (;;) {
    let c = FIRST[randomInt(FIRST.length)];
    for (let i = 1; i < 4; i++) c += ALPHABET[randomInt(ALPHABET.length)];
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
    level: isLevel(s.level) ? s.level : base.level,
    input: s.input === "choix" || s.input === "libre" ? s.input : base.input,
    rounds: Number.isInteger(s.rounds) ? Math.min(101, Math.max(5, s.rounds as number)) : base.rounds,
    regions,
    elimination: typeof s.elimination === "boolean" ? s.elimination : base.elimination,
    levels: s.levels && typeof s.levels === "object"
      ? Object.fromEntries(Object.entries(s.levels).filter(([k, v]) => typeof k === "string" && k.length < 40 && isLevel(v)).slice(0, 100)) as Record<string, Level>
      : base.levels,
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
  /** Nombre de joueurs au lancement : la fin par élimination n'a de sens qu'à plusieurs. */
  startPlayers = 0;
  /** Questions par niveau (handicap) : mêmes départements et indices, champs différents. */
  byLevel: Partial<Record<Level, Question[]>> = {};
  /** Mode en équipe */
  team: TeamState = { lives: TEAM_LIVES, accuracy: 0, score: 0, lostLife: false };
  teamAcc: number[] = [];

  levelOf(id: string): Level { return this.settings.levels[id] ?? this.settings.level; }
  qFor(id: string | null, i = this.qi): Question { return (id && this.byLevel[this.levelOf(id)]?.[i]) || this.questions[i]; }
  syncLevels() { for (const s of this.seats.values()) s.info.level = this.levelOf(s.info.id); }

  setLevel(c: Conn, player: string, level: unknown) {
    if (this.phase !== "lobby" || !isLevel(level) || !this.seats.has(player)) return;
    if (player !== c.playerId && !this.isHost(c)) return fail(c, "not_host", "Seul l'hôte peut changer le niveau d'un autre joueur.");
    this.settings = { ...this.settings, levels: { ...this.settings.levels, [player]: level } };
    this.syncLevels();
    this.broadcastRoom();
  }

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
    // Handicap par défaut : chacun joue à son niveau (réglable ensuite par lui-même ou l'hôte).
    if (this.kind !== "daily" && !this.settings.levels[c.playerId]) this.settings = { ...this.settings, levels: { ...this.settings.levels, [c.playerId]: c.level } };
    this.seats.set(c.playerId, {
      info: { id: c.playerId, name: c.name, home: c.home ?? undefined, score: 0, connected: true, eliminated: false, answered: false, host, level: this.levelOf(c.playerId) },
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
      const q = c.spectating ? this.questions[this.qi] : this.qFor(c.playerId);
      if (q) send(c, { t: "question", q: this.payload(q) });
    }
  }

  // ---------- partie ----------
  updateSettings(c: Conn, s: Partial<RoomSettings>) {
    if (!this.isHost(c)) return fail(c, "not_host", "Seul l'hôte peut changer les règles.");
    if (this.phase !== "lobby") return fail(c, "already_started", "La partie a déjà commencé.");
    this.settings = clampSettings(s, this.settings);
    this.syncLevels();
    this.broadcastRoom();
  }

  start(c: Conn | null) {
    if (c && !this.isHost(c)) return fail(c, "not_host", "Seul l'hôte peut lancer la partie.");
    if (this.phase !== "lobby") return;
    const codes = this.settings.regions.length ? DEPARTEMENTS.filter((d) => this.settings.regions.includes(d.region)).map((d) => d.code) : undefined;
    const cfg = this.kind === "daily" && this.day
      ? dailyConfig(this.day, this.settings.level)
      : { seed: randomSeed(), level: this.settings.level, input: this.settings.input, rounds: this.settings.rounds, codes };
    if (this.kind === "daily") {
      this.questions = makeGame(cfg);
      this.byLevel = {};
    } else {
      // Même graine pour tous les niveaux : mêmes départements, mêmes indices, mêmes propositions.
      const levels = new Set<Level>([this.settings.level, ...[...this.seats.keys()].map((id) => this.levelOf(id))]);
      const durationMs = Math.max(...[...levels].map((l) => DEFAULT_DURATION[l]));
      this.byLevel = Object.fromEntries([...levels].map((l) => [l, makeGame({ ...cfg, level: l, durationMs })]));
      this.questions = this.byLevel[this.settings.level]!;
    }
    this.team = { lives: TEAM_LIVES, accuracy: 0, score: 0, lostLife: false };
    this.teamAcc = [];
    this.hpMode = this.kind === "duel" && this.seats.size === 2;
    this.startPlayers = this.seats.size;
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
    return { index: q.index, total: this.questions.length, code: q.code, hint: q.hint, fields: q.fields, choices: q.choices, mapChoices: q.mapChoices, durationMs: q.durationMs, startsAt: this.startsAt, endsAt: this.endsAt };
  }

  private ask(i: number) {
    this.qi = i;
    const q = this.questions[i];
    this.startsAt = now() + LEAD_MS;
    this.endsAt = this.startsAt + q.durationMs;
    for (const s of this.seats.values()) s.info.answered = false;
    this.phase = "question";
    this.broadcastRoom();
    for (const s of this.seats.values()) if (s.conn) send(s.conn, { t: "question", q: this.payload(this.qFor(s.info.id, i)) });
    for (const c of this.spectators) send(c, { t: "question", q: this.payload(q) });
    this.schedule(this.endsAt - now() + GRACE_MS, () => this.closeRound());
  }

  answer(c: Conn, index: number, raw: unknown) {
    const seat = this.seats.get(c.playerId);
    if (!seat || seat.info.eliminated || this.phase !== "question" || index !== this.qi || seat.results[index]) return;
    const t = now();
    if (t > this.endsAt + GRACE_MS) return;
    const q = this.qFor(c.playerId, index);
    const elapsedMs = Math.min(q.durationMs, Math.max(0, t - this.startsAt - c.rttMs / 2));
    const r = grade(q, { ...sanitizeAnswer(raw), elapsedMs });
    // En salon, points normalisés : un joueur en expert ne marque pas plus pour ses questions en plus.
    if (this.kind !== "daily") r.points = roomPoints(r.accuracy, r.elapsedMs, q.durationMs);
    seat.results[index] = r;
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
    let team: TeamState | undefined;
    if (this.kind === "coop") {
      const present = this.active.filter((s) => s.info.connected || s.results[this.qi]);
      const acc = present.length ? present.reduce((n, s) => n + (s.results[this.qi]?.accuracy ?? 0), 0) / present.length : 0;
      this.teamAcc.push(acc);
      const lostLife = acc < TEAM_LIFE_THRESHOLD;
      this.team = {
        lives: this.team.lives - (lostLife ? 1 : 0),
        accuracy: this.teamAcc.reduce((n, a) => n + a, 0) / this.teamAcc.length,
        score: this.team.score + Object.values(results).reduce((n, r) => n + r.points, 0),
        lostLife,
      };
      team = this.team;
    }
    const knockout = forfeit || (this.hpMode && [...this.seats.values()].some((s) => (s.info.hp ?? 1) <= 0)) || (this.kind === "coop" && this.team.lives <= 0);
    const lastSurvivor = this.settings.elimination && this.startPlayers >= 2 && this.active.length <= 1;
    const last = knockout || this.qi + 1 >= this.questions.length || lastSurvivor;
    const review = this.kind === "daily" ? 0 : REVIEW_MS;
    const nextAt = last ? null : now() + review;
    this.phase = "review";
    this.broadcastRoom();
    this.broadcast({ t: "round", summary: { index: this.qi, code: q.code, results, eliminated, damage, team, nextAt } });
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
    this.questions = []; this.byLevel = {}; this.qi = -1;
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
      const daily: DailyOutcome = { day: this.day, number: dailyNumber(this.day), level: this.settings.level, points, accuracy, elapsedMs, grid, saved, rank: rank?.rank, players: rank?.players };
      if (!seat?.userId) bump("defi_invite");
      if (!seat?.userId) daily.claim = newClaim({ day: this.day, level: this.settings.level, points, accuracy, elapsedMs, grid });
      this.broadcast({ t: "end", ranking, daily });
    } else if (this.kind === "coop") {
      this.broadcast({ t: "end", ranking, team: { ...this.team, stars: teamStars(this.team.accuracy, this.team.lives) } });
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
      // Ancienne version en vidange : les nouvelles parties vont sur la nouvelle (le client se reconnecte).
      if (life.draining) { fail(c, "bad_request", "Hexa vient d'être mis à jour : réessaie dans un instant."); c.ws.close(4001, "nouvelle version"); return; }
      c.room?.leave(c);
      if (msg.kind === "daily") {
        const day = today();
        // Son niveau ou en dessous, jamais au-dessus (conception 4.3).
        const wanted = msg.settings?.level;
        const level: Level = isLevel(wanted) && levelAllowed(wanted, c.level) ? wanted : c.level;
        if (c.userId && !startDaily(day, c.userId, level)) return fail(c, "daily_done", "Tu as déjà joué le défi du jour. Rendez-vous demain !");
        const room = new Room("daily", { ...DEFAULT_SETTINGS, level, rounds: 10 });
        room.day = day;
        room.add(c);
        return room.start(null);
      }
      const kind: RoomKind = msg.kind === "plateau" ? "plateau" : msg.kind === "coop" ? "coop" : "duel";
      const base = { ...DEFAULT_SETTINGS, elimination: kind === "plateau" };
      const room = new Room(kind, clampSettings(msg.settings ?? {}, base));
      bump(`salon_${kind}`);
      room.add(c);
      return;
    }
    case "join": {
      const code = String(msg.room ?? "").toUpperCase().trim();
      const room = rooms.get(code);
      // Pendant une mise à jour, les codes de l'autre version (autre première lettre) sont chez elle.
      if (!room && life.color && code && !FIRST.includes(code[0])) return fail(c, "room_moved", "Ce salon est sur l'autre version : reconnexion…");
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
    case "rematch":
      if (life.draining) return fail(c, "bad_request", "Hexa vient d'être mis à jour : crée un nouveau salon pour rejouer.");
      return c.room?.rematch(c);
    case "react": return c.room?.react(c, msg.e);
    case "level": return c.room?.setLevel(c, String(msg.player), msg.level);
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

/** Salons où une partie (ou un salon d'attente) occupe encore des joueurs connectés. */
export function busyRooms(): number {
  return [...rooms.values()].filter((r) => r.phase !== "ended" && [...r.seats.values()].some((s) => s.conn)).length;
}
export const roomCodes = () => [...rooms.keys()];

export function stats() { return { rooms: rooms.size, players: [...rooms.values()].reduce((n, r) => n + r.seats.size, 0) }; }
