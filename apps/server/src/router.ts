// Aiguilleur du déploiement à deux versions (bleue / verte), devant les instances d'Hexa.
// - Tout ce qui est nouveau (pages, API, nouvelles connexions temps réel) va à l'instance ACTIVE.
// - Une connexion qui vise un salon précis (?room=CODE : rejoindre un ami, se reconnecter) va à l'instance qui
//   héberge ce salon, même si c'est l'ancienne, qui finit ainsi ses parties sans coupure.
// - Bascule : POST /switch?to=green sur le port de contrôle (local à la machine). L'ancienne passe en vidange
//   et s'arrête seule quand plus aucune partie n'occupe personne (voir life.ts et index.ts).
import { createServer, request, type IncomingMessage } from "node:http";
import { connect } from "node:net";
import { readFileSync, writeFileSync, renameSync } from "node:fs";

type Color = "blue" | "green";
interface Backend { host: string; port: number }
interface State { active: Color; draining: Color[] }

const PORT = Number(process.env.PORT ?? 8787);
const CONTROL_PORT = Number(process.env.CONTROL_PORT ?? 8786);
const STATE_FILE = process.env.ROUTER_STATE ?? "/data/router.json";
const TOKEN = process.env.INTERNAL_TOKEN ?? "";
const BACKENDS = Object.fromEntries((process.env.BACKENDS ?? "blue=hexapop-blue:8787,green=hexapop-green:8787").split(",").map((x) => {
  const [color, addr] = x.split("=");
  const [host, port] = addr.split(":");
  return [color, { host, port: Number(port) }];
})) as Record<Color, Backend>;
const COLORS = Object.keys(BACKENDS) as Color[];
const other = (c: Color): Color => (c === "blue" ? "green" : "blue");

let state: State = (() => {
  try { const s = JSON.parse(readFileSync(STATE_FILE, "utf8")) as State; if (COLORS.includes(s.active)) return { active: s.active, draining: (s.draining ?? []).filter((c) => COLORS.includes(c) && c !== s.active) }; } catch { /* premier démarrage */ }
  return { active: "blue", draining: [] };
})();
function save() {
  try { writeFileSync(STATE_FILE + ".tmp", JSON.stringify(state)); renameSync(STATE_FILE + ".tmp", STATE_FILE); } catch (e) { console.error("[aiguilleur] état non enregistré", e); }
}

/** Appel interne à une instance (salons, vidange, santé). */
function call(color: Color, path: string, method = "GET"): Promise<Record<string, unknown> | null> {
  const b = BACKENDS[color];
  return new Promise((resolve) => {
    const req = request({ host: b.host, port: b.port, path, method, headers: { "x-hexa-internal": TOKEN }, timeout: 3000 }, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => { try { resolve(res.statusCode === 200 ? JSON.parse(data) : null); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.end();
  });
}

/** Salons des instances en vidange (cache court : on ne les interroge qu'à l'arrivée d'une connexion ciblée). */
const roomCache = new Map<Color, { at: number; codes: string[] }>();
async function ownerOf(code: string): Promise<Color> {
  for (const c of state.draining) {
    let hit = roomCache.get(c);
    if (!hit || Date.now() - hit.at > 2000) {
      const r = await call(c, "/api/internal/rooms");
      hit = { at: Date.now(), codes: (r?.codes as string[]) ?? [] };
      roomCache.set(c, hit);
    }
    if (hit.codes.includes(code)) return c;
  }
  return state.active;
}

// ---------- trafic public ----------
const server = createServer((req, res) => {
  if (req.url?.startsWith("/api/internal/")) { res.writeHead(404).end(); return; }
  const b = BACKENDS[state.active];
  const up = request({ host: b.host, port: b.port, path: req.url, method: req.method, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  up.on("error", () => { if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" }); res.end('{"error":"offline","message":"Hexa redémarre, réessaie dans un instant."}'); });
  req.pipe(up);
});

// Connexions temps réel : relais brut de la connexion, vers l'instance qui héberge le salon visé.
server.on("upgrade", async (req: IncomingMessage, socket, head) => {
  const code = new URL(req.url ?? "/", "http://x").searchParams.get("room")?.toUpperCase().slice(0, 8);
  const color = code ? await ownerOf(code) : state.active;
  const b = BACKENDS[color];
  const up = connect(b.port, b.host, () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    up.write(lines.join("\r\n") + "\r\n\r\n");
    if (head?.length) up.write(head);
    up.pipe(socket); socket.pipe(up);
  });
  const close = () => { up.destroy(); socket.destroy(); };
  up.on("error", close); socket.on("error", close);
  up.on("close", () => socket.destroy()); socket.on("close", () => up.destroy());
});

// ---------- contrôle (local à la machine : publié sur 127.0.0.1 uniquement) ----------
const control = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const out = (status: number, data: unknown) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(data) + "\n");
  if (url.pathname === "/state") {
    const detail = Object.fromEntries(await Promise.all(COLORS.map(async (c) => [c, await call(c, "/api/internal/rooms")] as const)));
    return out(200, { ...state, instances: detail });
  }
  const to = url.searchParams.get("to") as Color | null;
  if (url.pathname === "/probe" && to && COLORS.includes(to)) {
    const r = await call(to, "/api/internal/rooms");
    return out(r ? 200 : 503, r ?? { error: "injoignable" });
  }
  if (url.pathname === "/switch" && req.method === "POST" && to && COLORS.includes(to)) {
    if (!(await call(to, "/api/internal/rooms"))) return out(503, { error: `${to} ne répond pas : bascule annulée` });
    if (to === state.active) return out(200, state);
    const old = state.active;
    state = { active: to, draining: [...new Set([...state.draining.filter((c) => c !== to), old])] };
    save();
    await call(old, "/api/internal/drain", "POST");
    console.log(`[aiguilleur] ${to} active, ${old} en vidange`);
    return out(200, state);
  }
  out(404, { error: "inconnu" });
});

// Les instances en vidange qui se sont arrêtées sont oubliées.
setInterval(async () => {
  const before = state.draining.length;
  const alive: Color[] = [];
  for (const c of state.draining) if (await call(c, "/api/internal/rooms")) alive.push(c);
  state.draining = alive;
  if (alive.length !== before) { save(); console.log(`[aiguilleur] vidange terminée, en ligne : ${state.active}`); }
}, 15_000).unref();

if (!TOKEN) console.warn("[aiguilleur] INTERNAL_TOKEN manquant : salons et vidange indisponibles");
server.listen(PORT, () => console.log(`[aiguilleur] :${PORT} -> ${state.active} (${BACKENDS[state.active].host}:${BACKENDS[state.active].port}), contrôle :${CONTROL_PORT}`));
control.listen(CONTROL_PORT);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(0));
