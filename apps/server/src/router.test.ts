// Test du déploiement à deux versions : aiguilleur + instance bleue + instance verte, sur la même base.
// Scénario d'une mise à jour : une partie démarre sur la bleue, on bascule sur la verte ; les nouveaux joueurs vont
// sur la verte, un ami qui rejoint la partie en cours arrive sur la bleue, et la bleue s'arrête seule à la fin.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { PROTOCOL_VERSION, type ServerMsg } from "@hexa/game";

const base = 19000 + Math.floor(Math.random() * 500) * 4;
const P = { router: base, control: base + 1, blue: base + 2, green: base + 3 };
const dir = mkdtempSync(join(tmpdir(), "hexa-bg-"));
const env = { ...process.env, DB_PATH: join(dir, "t.db"), INTERNAL_TOKEN: "jeton-test" };
const procs: Record<string, ChildProcess> = {};
const exited: Record<string, number | null> = {};
let logs = "";

function start(name: string, args: string[], extra: Record<string, string>) {
  const p = spawn(process.execPath, args, { env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"] });
  p.stdout!.on("data", (d) => (logs += d)); p.stderr!.on("data", (d) => (logs += d));
  p.on("exit", (code) => (exited[name] = code));
  procs[name] = p;
}
async function up(url: string) {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch { /* pas prêt */ } await new Promise((r) => setTimeout(r, 100)); }
  throw new Error(`${url} ne répond pas : ${logs}`);
}

before(async () => {
  start("blue", ["src/index.ts"], { PORT: String(P.blue), COLOR: "blue" });
  start("green", ["src/index.ts"], { PORT: String(P.green), COLOR: "green" });
  await up(`http://127.0.0.1:${P.blue}/api/health`); await up(`http://127.0.0.1:${P.green}/api/health`);
  start("router", ["src/router.ts"], { PORT: String(P.router), CONTROL_PORT: String(P.control), ROUTER_STATE: join(dir, "router.json"), BACKENDS: `blue=127.0.0.1:${P.blue},green=127.0.0.1:${P.green}` });
  await up(`http://127.0.0.1:${P.router}/api/health`);
});
after(() => { for (const p of Object.values(procs)) p.kill(); rmSync(dir, { recursive: true, force: true }); });

class Client {
  ws: WebSocket; inbox: ServerMsg[] = []; waiters: (() => void)[] = []; closed = false;
  constructor(room?: string) {
    this.ws = new WebSocket(`ws://127.0.0.1:${P.router}/api/ws${room ? `?room=${room}` : ""}`);
    this.ws.on("message", (d) => { this.inbox.push(JSON.parse(String(d))); for (const w of this.waiters.splice(0)) w(); });
    this.ws.on("close", () => { this.closed = true; for (const w of this.waiters.splice(0)) w(); });
  }
  open() { return new Promise((r) => this.ws.once("open", r)); }
  send(m: unknown) { this.ws.send(JSON.stringify(m)); }
  async wait<T extends ServerMsg["t"]>(t: T, pred: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true, ms = 8000) {
    const end = Date.now() + ms;
    for (;;) {
      const i = this.inbox.findIndex((m) => m.t === t && pred(m as Extract<ServerMsg, { t: T }>));
      if (i >= 0) return this.inbox.splice(i, 1)[0] as Extract<ServerMsg, { t: T }>;
      if (Date.now() > end) throw new Error(`pas de « ${t} » : ${JSON.stringify(this.inbox.slice(-3))}`);
      await new Promise<void>((r) => { this.waiters.push(r); setTimeout(r, 200); });
    }
  }
}
const color = async () => (await (await fetch(`http://127.0.0.1:${P.router}/api/health`)).json()).color;

test("mise à jour sans coupure : bascule, partie finie sur l'ancienne, arrêt automatique", { timeout: 60_000 }, async () => {
  assert.equal(await color(), "blue");
  // Une partie en salon d'attente sur la bleue.
  const a = new Client(); await a.open();
  a.send({ t: "hello", v: PROTOCOL_VERSION, name: "Ana" }); await a.wait("welcome");
  a.send({ t: "create", kind: "duel" });
  const code = (await a.wait("room")).room;
  assert.ok("ABCDEFGHJKLM".includes(code[0]), "code de la bleue");
  // Un joueur sans partie, connecté à la bleue avant la bascule.
  const idle = new Client(); await idle.open();
  idle.send({ t: "hello", v: PROTOCOL_VERSION, name: "Idle" }); await idle.wait("welcome");

  // Bascule vers la verte.
  const sw = await fetch(`http://127.0.0.1:${P.control}/switch?to=green`, { method: "POST" });
  assert.equal(sw.status, 200);
  assert.deepEqual(await sw.json(), { active: "green", draining: ["blue"] });
  assert.equal(await color(), "green", "les pages et l'API viennent de la verte");
  await idle.wait("error", undefined, 3000).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(idle.closed, "le joueur sans partie est renvoyé vers la nouvelle version");

  // Un ami rejoint la partie en cours : il arrive sur la bleue.
  const b = new Client(code); await b.open();
  b.send({ t: "hello", v: PROTOCOL_VERSION, name: "Bob", room: code });
  await b.wait("welcome");
  const room = await b.wait("room", (m) => m.players.length === 2);
  assert.equal(room.room, code);
  // Rejoindre en tapant le code depuis une connexion de la verte : « ce salon est sur l'autre version ».
  const c = new Client(); await c.open();
  c.send({ t: "hello", v: PROTOCOL_VERSION, name: "Cleo" }); await c.wait("welcome");
  c.send({ t: "join", room: code });
  assert.equal((await c.wait("error")).code, "room_moved");
  // Un nouveau salon est créé sur la verte.
  c.send({ t: "create", kind: "duel" });
  const code2 = (await c.wait("room")).room;
  assert.ok("PQRSTUVWXYZN".includes(code2[0]), "code de la verte");

  // La partie de la bleue se termine (les joueurs partent) : la bleue s'arrête seule.
  assert.equal(exited.blue, undefined, "la bleue tourne encore tant que la partie occupe des joueurs");
  a.send({ t: "leave" }); b.send({ t: "leave" }); a.ws.close(); b.ws.close();
  for (let i = 0; i < 40 && exited.blue === undefined; i++) await new Promise((r) => setTimeout(r, 250));
  assert.equal(exited.blue, 0, "la bleue s'est arrêtée proprement");
  assert.equal(await color(), "green");
  c.ws.close();
});
