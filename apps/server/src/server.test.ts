// Test d'intégration : lance le vrai serveur sur une base temporaire.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { DEP, PROTOCOL_VERSION, type ServerMsg, type QuestionPayload } from "@hexa/game";

const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), "hexa-test-"));
let srv: ChildProcess;
let logs = "";

before(async () => {
  srv = spawn(process.execPath, ["src/index.ts"], { env: { ...process.env, PORT: String(PORT), DB_PATH: join(dir, "t.db") }, stdio: ["ignore", "pipe", "pipe"] });
  srv.stdout!.on("data", (d) => (logs += d));
  srv.stderr!.on("data", (d) => (logs += d));
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + "/api/health")).ok) return; } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("serveur pas démarré : " + logs);
});
after(() => { srv.kill(); rmSync(dir, { recursive: true, force: true }); });

const post = (path: string, body: unknown, token?: string) =>
  fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

test("comptes : inscription, vérification, connexion, progression", async () => {
  let r = await post("/api/auth/register", { email: "leo@example.com", pseudo: "Léo", password: "motdepasse", home: "29" });
  assert.equal(r.status, 201);
  const { token, user } = await r.json();
  assert.equal(user.home, "29");
  assert.equal(user.emailVerified, false);
  assert.match(r.headers.get("set-cookie") ?? "", /hexa_session=.*HttpOnly/);

  r = await post("/api/auth/register", { email: "LEO@example.com", pseudo: "autre", password: "motdepasse" });
  assert.equal(r.status, 409);

  const link = /#verifier=([\w-]+)/.exec(logs)?.[1];
  assert.ok(link, "email de vérification journalisé");
  assert.equal((await post("/api/auth/verify", { token: link })).status, 200);

  r = await post("/api/auth/login", { login: "léo", password: "faux" });
  assert.equal(r.status, 401);
  r = await post("/api/auth/login", { login: "leo@example.com", password: "motdepasse" });
  assert.equal(r.status, 200);

  const me = await (await fetch(BASE + "/api/me", { headers: { authorization: `Bearer ${token}` } })).json();
  assert.equal(me.user.emailVerified, true);

  r = await fetch(BASE + "/api/progress", { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ progress: { "29": { box: 2, due: 1, seen: 3, correct: 2 }, "XX": { box: 1 } } }) });
  const p = await r.json();
  assert.deepEqual(Object.keys(p.progress), ["29"]);
});

class Client {
  ws: WebSocket;
  inbox: ServerMsg[] = [];
  waiters: { pred: (m: ServerMsg) => boolean; res: (m: ServerMsg) => void }[] = [];
  constructor(token?: string) {
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/api/ws`, token ? { headers: { authorization: `Bearer ${token}` } } : undefined);
    this.ws.on("message", (d) => {
      const m = JSON.parse(String(d)) as ServerMsg;
      const w = this.waiters.findIndex((x) => x.pred(m));
      if (w >= 0) this.waiters.splice(w, 1)[0].res(m); else this.inbox.push(m);
    });
  }
  open() { return new Promise((r) => this.ws.once("open", r)); }
  send(m: object) { this.ws.send(JSON.stringify(m)); }
  wait<T extends ServerMsg["t"]>(t: T, pred: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true, ms = 8000): Promise<Extract<ServerMsg, { t: T }>> {
    const match = (m: ServerMsg) => m.t === t && pred(m as Extract<ServerMsg, { t: T }>);
    const i = this.inbox.findIndex(match);
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0] as Extract<ServerMsg, { t: T }>);
    return new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error(`attente ${t} expirée`)), ms);
      this.waiters.push({ pred: match, res: (m) => { clearTimeout(timer); res(m as Extract<ServerMsg, { t: T }>); } });
    });
  }
}

function perfect(q: QuestionPayload) {
  const d = DEP.get(q.code)!;
  return { carte: d.code, nom: d.nom, numero: d.code, prefecture: d.prefecture };
}

test("duel en direct : le plus rapide marque plus, le serveur note", { timeout: 60_000 }, async () => {
  const a = new Client(), b = new Client();
  await Promise.all([a.open(), b.open()]);
  a.send({ t: "hello", v: PROTOCOL_VERSION, name: "Inès" });
  b.send({ t: "hello", v: PROTOCOL_VERSION, name: "Bastien" });
  const wa = await a.wait("welcome");
  await b.wait("welcome");

  a.send({ t: "create", kind: "duel", settings: { rounds: 5, level: "normal", input: "libre" } });
  const room = await a.wait("room");
  assert.equal(room.room.length, 4);
  b.send({ t: "join", room: room.room.toLowerCase() });
  await a.wait("room", (m) => m.players.length === 2);

  b.send({ t: "start" });
  const err = await b.wait("error");
  assert.equal(err.code, "not_host");

  a.send({ t: "start" });
  const q1 = (await a.wait("question")).q;
  await b.wait("question");
  assert.equal(q1.total, 5);
  // Inès répond juste et vite, Bastien répond faux.
  a.send({ t: "answer", index: 0, answer: perfect(q1) });
  b.send({ t: "answer", index: 0, answer: { carte: "75", nom: "zzz", numero: "00", prefecture: "zzz" } });
  const s1 = (await a.wait("round")).summary;
  assert.equal(s1.code, q1.code);
  const ra = s1.results[wa.you];
  assert.equal(ra.accuracy, 1);
  assert.ok(ra.points > 300, `points ${ra.points}`);
  assert.ok(s1.nextAt && s1.nextAt > Date.now());

  // Double réponse ignorée, réponse hors délai ignorée : on vérifie juste que ça ne casse rien.
  a.send({ t: "answer", index: 0, answer: perfect(q1) });
  a.send({ t: "leave" });
  for (let i = 1; i < 5; i++) {
    const q = (await b.wait("question", (m) => m.q.index === i, 15_000)).q;
    b.send({ t: "answer", index: i, answer: perfect(q) });
  }
  const end = await b.wait("end", undefined, 15_000);
  assert.equal(end.ranking.length, 1);
  a.ws.close(); b.ws.close();
});

test("défi du jour : un seul essai par compte", { timeout: 60_000 }, async () => {
  const r = await post("/api/auth/register", { email: "daily@example.com", pseudo: "Daily", password: "motdepasse", home: "13" });
  const { token } = await r.json();
  const c = new Client(token);
  await c.open();
  c.send({ t: "hello", v: PROTOCOL_VERSION });
  assert.equal((await c.wait("welcome")).account, true);
  c.send({ t: "create", kind: "daily" });
  for (let i = 0; i < 10; i++) {
    const q = (await c.wait("question")).q;
    assert.equal(q.index, i);
    c.send({ t: "answer", index: i, answer: i % 2 ? perfect(q) : {} });
    await c.wait("round");
    c.send({ t: "next" });
  }
  const end = await c.wait("end");
  assert.ok(end.daily);
  assert.equal(end.daily.saved, true);
  assert.equal(end.daily.rank, 1);
  assert.deepEqual(end.daily.grid, [0, 2, 0, 2, 0, 2, 0, 2, 0, 2]);

  c.send({ t: "create", kind: "daily" });
  assert.equal((await c.wait("error")).code, "daily_done");
  const lb = await (await fetch(BASE + "/api/daily/leaderboard")).json();
  assert.equal(lb.top[0].name, "Daily");
  c.ws.close();
});
