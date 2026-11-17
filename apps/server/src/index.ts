import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { PROTOCOL_VERSION, isLevel, type ClientMsg } from "@hexa/game";
import { config } from "./config.ts";
import { handleApi, sessionToken, clientIp } from "./api.ts";
import { userFromSession, rateLimit } from "./auth.ts";
import { handle, newPlayerId, send, fail, type Conn } from "./rooms.ts";
import { purge } from "./db.ts";
import { accountLevel, higherLevel } from "./daily.ts";
import { startPushScheduler } from "./push.ts";
startPushScheduler();

// Purge quotidienne des données arrivées à échéance (et une fois au démarrage).
const runPurge = () => { const r = purge(); if (Object.values(r).some((n) => n > 0)) console.log("[purge]", r); };
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
};
function serveStatic(url: string, res: import("node:http").ServerResponse) {
  const path = decodeURIComponent(url.split("?")[0]);
  let file = normalize(join(config.webDir, path));
  if (!file.startsWith(normalize(config.webDir))) { res.writeHead(403).end(); return; }
  let st;
  try { st = statSync(file); if (st.isDirectory()) { file = join(file, "index.html"); st = statSync(file); } }
  catch { file = join(config.webDir, "index.html"); st = statSync(file); }
  const immutable = path.startsWith("/assets/");
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "content-length": st.size,
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  });
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  const url = req.url ?? "/";
  if (url.startsWith("/api/")) return void handleApi(req, res);
  if (config.webDir && (req.method === "GET" || req.method === "HEAD")) return serveStatic(url, res);
  res.writeHead(404).end();
});

// ---------- WebSocket temps réel ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
const resumeIds = new Map<string, string>(); // jeton de reprise -> id joueur (reconnexion)

server.on("upgrade", (req, socket, head) => {
  if (!req.url?.startsWith("/api/ws")) return socket.destroy();
  if (!rateLimit("ws:" + clientIp(req), 60, 60_000)) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, sessionToken(req)));
});

function guestName(raw: unknown): string {
  const n = typeof raw === "string" ? raw.replace(/[^\p{L}\p{N}_.\- ]/gu, "").trim().slice(0, 20) : "";
  return n.length >= 2 ? n : `Invité ${Math.floor(Math.random() * 900 + 100)}`;
}

function onConnection(ws: WebSocket, cookieToken: string | undefined) {
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
      conn = { ws, playerId, name: user?.pseudo ?? guestName(msg.name), userId: user?.id ?? null, home: user?.home_dep ?? null, level, rttMs: 0, room: null, spectating: false };
      send(conn, { t: "welcome", you: playerId, name: conn.name, resume, serverNow: Date.now(), account: !!user });
      if (msg.room) handle(conn, { t: "join", room: msg.room });
      return;
    }
    try { handle(conn, msg); } catch (e) { console.error(e); fail(conn, "bad_request", "Requête invalide."); }
  });

  ws.on("close", () => {
    clearInterval(pinger);
    clearInterval(refill);
    conn?.room?.disconnect(conn);
  });
}

server.listen(config.port, () => console.log(`Hexa écoute sur :${config.port}${config.webDir ? ` (web : ${config.webDir})` : ""}`));

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { server.close(); wss.close(); process.exit(0); });
