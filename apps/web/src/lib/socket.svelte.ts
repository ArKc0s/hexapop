// Client WebSocket : connexion, synchro d'horloge, état du salon, reconnexion automatique.
import { LEVEL_OF, playerLevel } from "@hexa/game";
import { profile } from "./profile.svelte.ts";
import { guestId } from "./guest.ts";
import {
  PROTOCOL_VERSION, type ClientMsg, type DailyOutcome, type Phase, type PlayerInfo, type QuestionPayload,
  type RoomKind, type RoomSettings, type RoundSummary, type ServerMsg, type RoundResult, type Question, type TeamState, grade,
} from "@hexa/game";

const RESUME_KEY = "hexa.resume";

export interface RoomState {
  code: string;
  kind: RoomKind;
  settings: RoomSettings;
  players: PlayerInfo[];
  phase: Phase;
  spectators: number;
}

class Live {
  status = $state<"idle" | "connecting" | "open" | "closed">("idle");
  you = $state<string | null>(null);
  name = $state("");
  account = $state(false);
  room = $state<RoomState | null>(null);
  question = $state<QuestionPayload | null>(null);
  summary = $state<RoundSummary | null>(null);
  ranking = $state<PlayerInfo[] | null>(null);
  daily = $state<DailyOutcome | null>(null);
  /** Fin de partie en équipe. */
  teamEnd = $state<(TeamState & { stars: number }) | null>(null);
  error = $state<{ code: string; message: string } | null>(null);
  answered = $state<Set<string>>(new Set());
  /** Mes résultats de la partie en cours (pour l'XP et l'album). */
  myResults = $state<RoundResult[]>([]);
  /** Réactions reçues récemment (affichées quelques secondes). */
  reactions = $state<{ id: number; player: string; e: string }[]>([]);
  private reactId = 0;
  /** Décalage horloge serveur - horloge locale (ms). */
  offset = 0;
  rtt = $state(0);

  private ws: WebSocket | null = null;
  private guestName = "";
  private wantRoom: string | null = null;
  private wantSpectate = false;
  private movedFor: string | null = null;
  private retries = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private queue: ClientMsg[] = [];
  private onWelcome: (() => void) | null = null;

  serverNow() { return Date.now() + this.offset; }
  /** Convertit une heure serveur en horodatage performance.now() local. */
  toPerf(serverTime: number) { return performance.now() + (serverTime - this.serverNow()); }

  connect(guestName = "", then?: () => void) {
    this.guestName = guestName || this.guestName;
    this.onWelcome = then ?? null;
    if (this.ws && this.status !== "closed") { if (this.status === "open") { then?.(); this.onWelcome = null; } return; }
    this.status = "connecting";
    // Le salon visé dans l'adresse : pendant une mise à jour, l'aiguilleur envoie vers la version qui l'héberge.
    const target = this.room?.code ?? this.wantRoom;
    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws${target ? `?room=${encodeURIComponent(target)}` : ""}`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.retries = 0;
      let resume = "";
      try { resume = sessionStorage.getItem(RESUME_KEY) ?? ""; } catch { /* rien */ }
      // Niveau d'après « Ta France » : handicap par défaut en salon, plafond du défi du jour.
      const level = LEVEL_OF[playerLevel(profile.data.know ?? {})];
      ws.send(JSON.stringify({ t: "hello", v: PROTOCOL_VERSION, name: this.guestName, resume, room: this.room?.code ?? this.wantRoom ?? undefined, spectate: this.wantSpectate || undefined, level, guest: guestId() ?? undefined, home: profile.data.home ?? undefined }));
    };
    ws.onmessage = (e) => this.receive(JSON.parse(e.data) as ServerMsg);
    ws.onclose = () => {
      if (this.ws !== ws) return; // ancienne connexion remplacée volontairement (salon sur l'autre version)
      this.status = "closed";
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.ws = null;
      // Reconnexion seulement si on est dans un salon en cours.
      if (this.room && this.room.phase !== "ended" && this.retries < 8) {
        const delay = Math.min(5000, 300 * 2 ** this.retries++);
        setTimeout(() => this.connect(), delay);
      }
    };
  }

  private ping() {
    this.send({ t: "ping", c: performance.now() });
  }

  send(m: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN && this.status === "open") this.ws.send(JSON.stringify(m));
    else if (m.t !== "ping") this.queue.push(m);
  }

  private receive(m: ServerMsg) {
    switch (m.t) {
      case "welcome": {
        this.status = "open";
        this.you = m.you; this.name = m.name; this.account = m.account;
        this.offset = m.serverNow - Date.now();
        try { sessionStorage.setItem(RESUME_KEY, m.resume); } catch { /* rien */ }
        this.ping();
        this.pingTimer = setInterval(() => this.ping(), 4000);
        const q = this.queue; this.queue = [];
        for (const x of q) this.send(x);
        this.onWelcome?.(); this.onWelcome = null;
        break;
      }
      case "pong": {
        const t1 = performance.now();
        const rtt = t1 - m.c;
        // Échantillon retenu si la latence est raisonnable : horloge = serveur + rtt/2.
        if (!this.rtt || rtt < this.rtt * 1.5) {
          const sample = m.s + rtt / 2 - (Date.now());
          this.offset = this.rtt ? this.offset * 0.7 + sample * 0.3 : sample;
        }
        this.rtt = this.rtt ? this.rtt * 0.7 + rtt * 0.3 : rtt;
        break;
      }
      case "room":
        this.error = null;
        this.room = { code: m.room, kind: m.kind, settings: m.settings, players: m.players, phase: m.phase, spectators: m.spectators };
        this.wantRoom = m.room;
        if (m.phase === "lobby") { this.ranking = null; this.summary = null; this.question = null; }
        break;
      case "question":
        if (m.q.index === 0) this.myResults = [];
        this.question = m.q; this.summary = null; this.answered = new Set();
        break;
      case "answered":
        this.answered = new Set([...this.answered, m.player]);
        break;
      case "round": {
        this.summary = m.summary;
        const q = this.question as Question | null;
        if (q && q.index === m.summary.index && !this.room?.players.find((p) => p.id === this.you)?.eliminated) {
          this.myResults = [...this.myResults, m.summary.results[this.you ?? ""] ?? grade(q, { elapsedMs: q.durationMs })];
        }
        break;
      }
      case "react": {
        const id = ++this.reactId;
        this.reactions = [...this.reactions.slice(-6), { id, player: m.player, e: m.e }];
        setTimeout(() => (this.reactions = this.reactions.filter((r) => r.id !== id)), 2500);
        break;
      }
      case "end":
        this.ranking = m.ranking; this.daily = m.daily ?? null; this.teamEnd = m.team ?? null;
        break;
      case "error":
        // Salon introuvable alors qu'on est déjà dans un autre : réponse périmée, on l'ignore.
        if (m.code === "room_not_found" && this.room) break;
        // Mise à jour en cours : ce salon est sur l'autre version. On se reconnecte en le visant, l'aiguilleur y mène.
        if (m.code === "room_moved" && this.wantRoom && this.movedFor !== this.wantRoom) {
          this.movedFor = this.wantRoom; // une seule tentative : si l'autre version est déjà arrêtée, le salon n'existe plus
          const old = this.ws; this.ws = null; this.status = "closed"; old?.close();
          this.connect();
          break;
        }
        if (m.code === "room_moved") m = { ...m, code: "room_not_found", message: "Aucun salon avec ce code." };
        if (m.code === "room_not_found") { this.wantRoom = null; if (location.hash.startsWith("#salon=")) history.replaceState(null, "", location.pathname); }
        this.error = { code: m.code, message: m.message };
        break;
    }
  }

  create(kind: RoomKind, settings?: Partial<RoomSettings>) { this.reset(); this.send({ t: "create", kind, settings }); }
  join(code: string, spectate = false) { this.reset(); this.wantRoom = code.toUpperCase(); this.wantSpectate = spectate; this.send({ t: "join", room: code, spectate }); }
  leave() { this.send({ t: "leave" }); this.reset(); this.room = null; this.wantRoom = null; this.wantSpectate = false; }
  private reset() { this.question = null; this.summary = null; this.ranking = null; this.daily = null; this.teamEnd = null; this.error = null; this.answered = new Set(); }
}

export const live = new Live();
