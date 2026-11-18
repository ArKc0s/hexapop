import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { DEP, PROTOCOL_VERSION, isLevel, type ClientMsg } from "@hexa/game";
import { config } from "./config.ts";
import { handleApi, sessionToken, clientIp } from "./api.ts";
import { userFromSession, rateLimit } from "./auth.ts";
import { handle, newPlayerId, send, fail, type Conn } from "./rooms.ts";
import { purge } from "./db.ts";
import { accountLevel, higherLevel, isGuestId } from "./daily.ts";
import { startPushScheduler } from "./push.ts";
import { life } from "./life.ts";
import { busyRooms, roomCodes, stats } from "./rooms.ts";
import { shareCardPng, sharePage } from "./share.ts";
import { peak } from "./stats.ts";
// Pic de joueurs connectés en même temps, par jour (statistiques).
setInterval(() => { const n = stats().players; if (n > 0 && !life.draining) peak("joueurs_max", n); }, 30_000).unref();
startPushScheduler();

// Purge quotidienne des données arrivées à échéance (et une fois au démarrage).
const runPurge = () => { if (life.draining) return; const r = purge(); if (Object.values(r).some((n) => n > 0)) console.log("[purge]", r); };
runPurge();
setInterval(runPurge, 24 * 3_600_000).unref();

// ---------- fichiers statiques (client web compilé) ----------
// Tout est servi depuis notre domaine : aucune ressource tierce, aucun traceur.
const SECURITY_HEADERS = {
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' wss: ws:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
};
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon",
};
function serveStatic(url: string, res: import("node:http").ServerResponse) {
  const path = decodeURIComponent(url.split("?")[0]);
  let file = normalize(join(config.webDir, path));
  if (!file.startsWith(normalize(config.webDir))) { res.writeHead(403).end(); return; }
  let st;
  let status = 200;
  try { st = statSync(file); if (st.isDirectory()) { file = join(file, "index.html"); st = statSync(file); } }
  catch {
    // Le jeu n'a qu'une page (« / », écrans en #…) : une adresse inconnue est une vraie 404, pas l'accueil
    // (les moteurs de recherche pénalisent les fausses pages « trouvées »).
    file = join(config.webDir, "404.html");
    try { st = statSync(file); status = 404; } catch { file = join(config.webDir, "index.html"); st = statSync(file); }
  }
  const immutable = path.startsWith("/assets/");
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "content-length": st.size,
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  });
  createReadStream(file).pipe(res);
}

// ---------- routes internes (aiguilleur) : salons de cette instance, mise en vidange ----------
function internal(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
  if (!life.internalToken || req.headers["x-hexa-internal"] !== life.internalToken) { res.writeHead(404).end(); return; }
  const out = (data: unknown) => { res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(data)); };
  if (req.url === "/api/internal/rooms") return out({ ...stats(), color: life.color, draining: life.draining, codes: roomCodes(), busy: busyRooms() });
  if (req.url === "/api/internal/drain" && req.method === "POST") { drain(); return out({ ok: true }); }
  res.writeHead(404).end();
}

const server = createServer((req, res) => {
  const url = req.url ?? "/";
  if (url.startsWith("/api/internal/")) return internal(req, res);
  if (url.startsWith("/api/")) return void handleApi(req, res);
  // Image d'aperçu d'un résultat partagé (le lien la montre dans WhatsApp, Messages, Snapchat…).
  const card = /^\/d\/([\w-]{6,16})\.png$/.exec(url.split("?")[0]);
  if (card && (req.method === "GET" || req.method === "HEAD")) {
    const png = shareCardPng(card[1]);
    if (png) { res.writeHead(200, { "content-type": "image/png", "content-length": png.length, "cache-control": "public, max-age=86400" }).end(req.method === "HEAD" ? undefined : png); return; }
  }
  // Résultat partagé du défi du jour (voir share.ts).
  const shared = /^\/d\/([\w-]{6,16})$/.exec(url.split("?")[0]);
  if (shared && (req.method === "GET" || req.method === "HEAD")) {
    const html = sharePage(shared[1]);
    if (html) { res.writeHead(200, { ...SECURITY_HEADERS, "content-type": TYPES[".html"], "cache-control": "no-cache" }).end(req.method === "HEAD" ? undefined : html); return; }
  }
  if (config.webDir && (req.method === "GET" || req.method === "HEAD")) return serveStatic(url, res);
  res.writeHead(404).end();
});

// ---------- WebSocket temps réel ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
const resumeIds = new Map<string, string>(); // jeton de reprise -> id joueur (reconnexion)

server.on("upgrade", (req, socket, head) => {
  if (!req.url?.startsWith("/api/ws")) return socket.destroy();
  if (!rateLimit("ws:" + clientIp(req), 60, 60_000)) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, sessionToken(req), clientIp(req)));
});

function guestName(raw: unknown): string {
  const n = typeof raw === "string" ? raw.replace(/[^\p{L}\p{N}_.\- ]/gu, "").trim().slice(0, 20) : "";
  return n.length >= 2 ? n : `Invité ${Math.floor(Math.random() * 900 + 100)}`;
}

function onConnection(ws: WebSocket, cookieToken: string | undefined, ip: string) {
  let conn: Conn | null = null;
  let pingSent = 0;
  let alive = true;
  const pinger = setInterval(() => {
    if (!alive) { ws.terminate(); return; }
    alive = false;
    pingSent = performance.now();
    ws.ping();
  }, 5_000);
  ws.on("pong", () => {
    alive = true;
    if (conn && pingSent) {
      const rtt = performance.now() - pingSent;
      conn.rttMs = Math.min(1_000, conn.rttMs ? conn.rttMs * 0.7 + rtt * 0.3 : rtt);
    }
  });
  let budget = 40; // messages par seconde
  const refill = setInterval(() => (budget = 40), 1_000);

  ws.on("message", (data) => {
    if (--budget < 0) return;
    let msg: ClientMsg;
    try { msg = JSON.parse(String(data)); } catch { return; }
    if (!msg || typeof msg !== "object") return;
    if (!conn) {
      if (msg.t !== "hello") return;
      if (msg.v !== PROTOCOL_VERSION) {
        ws.send(JSON.stringify({ t: "error", code: "version", message: "Mets l'application à jour." }));
        return ws.close();
      }
      const user = userFromSession(msg.token ?? cookieToken);
      let playerId = msg.resume ? resumeIds.get(msg.resume) : undefined;
      let resume = msg.resume && playerId ? msg.resume : "";
      if (!playerId) {
        playerId = user ? `u${user.id}` : newPlayerId();
        resume = newPlayerId() + newPlayerId();
        resumeIds.set(resume, playerId);
      }
      // Sans niveau (ancien client) : Confirmé, comme avant la v1.6.
      const own = isLevel(msg.level) ? msg.level : "normal";
      const level = user ? higherLevel(own, accountLevel(user.id)) : own;
      conns.add(ws);
      const guestHome = typeof msg.home === "string" && DEP.has(msg.home) ? msg.home : null;
      conn = { ws, playerId, name: user?.pseudo ?? guestName(msg.name), userId: user?.id ?? null, home: user?.home_dep ?? guestHome, level, guestId: !user && isGuestId(msg.guest) ? msg.guest : null, ip, rttMs: 0, room: null, spectating: false };
      const me = conn;
      connRoom.set(ws, () => !!me.room);
      send(conn, { t: "welcome", you: playerId, name: conn.name, resume, serverNow: Date.now(), account: !!user });
      if (msg.room) handle(conn, { t: "join", room: msg.room, spectate: !!msg.spectate });
      return;
    }
    try { handle(conn, msg); } catch (e) { console.error(e); fail(conn, "bad_request", "Requête invalide."); }
  });

  ws.on("close", () => {
    conns.delete(ws);
    clearInterval(pinger);
    clearInterval(refill);
    conn?.room?.disconnect(conn);
  });
}

/** Connexions ayant dit bonjour, avec leur salon éventuel (pour la vidange). */
const conns = new Set<WebSocket>();
const connRoom = new WeakMap<WebSocket, () => boolean>();

/**
 * Vidange : les joueurs sans partie (accueil, salon pas encore rejoint) sont reconnectés vers la nouvelle version ;
 * ceux en partie finissent tranquillement. Dès qu'aucune partie n'occupe plus personne, l'instance s'arrête (code 0,
 * l'aiguilleur l'oublie). Trois heures au plus.
 */
function drain() {
  if (life.draining) return;
  life.draining = true;
  const t0 = Date.now();
  console.log(`[vidange] ${life.color || "instance"} : plus de nouvelle partie, ${busyRooms()} en cours`);
  for (const ws of wss.clients) if (!connRoom.get(ws)?.()) ws.close(4001, "nouvelle version");
  setInterval(() => {
    if (busyRooms() > 0 && Date.now() - t0 < 3 * 3_600_000) return;
    console.log("[vidange] terminée, arrêt");
    server.close(); wss.close(); process.exit(0);
  }, 5_000);
}

server.listen(config.port, () => console.log(`Hexa écoute sur :${config.port}${config.webDir ? ` (web : ${config.webDir})` : ""}`));

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { server.close(); wss.close(); process.exit(0); });
