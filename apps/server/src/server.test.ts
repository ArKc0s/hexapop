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
  srv = spawn(process.execPath, ["src/index.ts"], { env: { ...process.env, PORT: String(PORT), DB_PATH: join(dir, "t.db"), GOOGLE_CLIENT_ID: "id-test", GOOGLE_CLIENT_SECRET: "secret-test" }, stdio: ["ignore", "pipe", "pipe"] });
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
  // Inès abandonne : Bastien gagne par forfait à la fin du tour suivant.
  a.send({ t: "leave" });
  const q2 = (await b.wait("question", (m) => m.q.index === 1, 15_000)).q;
  b.send({ t: "answer", index: 1, answer: perfect(q2) });
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

test("RGPD : export puis suppression définitive du compte", async () => {
  let r = await post("/api/auth/register", { email: "rgpd@example.com", pseudo: "Rgpd", password: "motdepasse", home: "75" });
  const { token } = await r.json();
  const auth = { authorization: `Bearer ${token}` };
  r = await fetch(BASE + "/api/me/export", { headers: auth });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.account.email, "rgpd@example.com");
  assert.ok(!JSON.stringify(data).includes("scrypt$"), "le hachage n'est pas exporté");
  r = await fetch(BASE + "/api/me", { method: "DELETE", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ password: "faux" }) });
  assert.equal(r.status, 403);
  r = await fetch(BASE + "/api/me", { method: "DELETE", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ password: "motdepasse" }) });
  assert.equal(r.status, 200);
  assert.equal((await fetch(BASE + "/api/me", { headers: auth })).status, 401, "session invalidée");
  assert.equal((await post("/api/auth/login", { login: "Rgpd", password: "motdepasse" })).status, 401, "compte supprimé");
});

test("duel à deux : points de vie, dégâts, réactions", { timeout: 60_000 }, async () => {
  const a = new Client(), b = new Client();
  await Promise.all([a.open(), b.open()]);
  a.send({ t: "hello", v: PROTOCOL_VERSION, name: "Ana" }); b.send({ t: "hello", v: PROTOCOL_VERSION, name: "Bob" });
  const wa = await a.wait("welcome"); const wb = await b.wait("welcome");
  a.send({ t: "create", kind: "duel", settings: { rounds: 5 } });
  const room = await a.wait("room");
  b.send({ t: "join", room: room.room });
  await a.wait("room", (m) => m.players.length === 2);
  a.send({ t: "start" });
  await a.wait("room", (m) => m.players.every((p) => p.hp === 1000));
  const q = (await a.wait("question")).q;
  a.send({ t: "answer", index: 0, answer: perfect(q) });
  b.send({ t: "answer", index: 0, answer: {} });
  const s = (await a.wait("round")).summary;
  assert.ok(s.damage && s.damage[wb.you] > 100, JSON.stringify(s.damage));
  const st = await a.wait("room", (m) => m.phase === "review");
  assert.equal(st.players.find((p) => p.id === wa.you)!.hp, 1000);
  assert.ok(st.players.find((p) => p.id === wb.you)!.hp! < 1000);
  b.send({ t: "react", e: "🔥" });
  const r = await a.wait("react");
  assert.equal(r.player, wb.you);
  b.send({ t: "react", e: "<script>" });
  a.ws.close(); b.ws.close();
});

test("profil de jeu : fusion côté serveur et nettoyage", async () => {
  const r = await post("/api/auth/register", { email: "profil@example.com", pseudo: "Profil", password: "motdepasse" });
  const { token } = await r.json();
  const put = (profile: unknown) => fetch(BASE + "/api/profile", { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ profile }) }).then((x) => x.json());
  await put({ xp: 300, plates: ["29", "56"], stars: { "53": 2 } });
  const m = await put({ xp: 120, tiers: { "13": 2, "29": 3, "ZZ": 1 }, stars: { "53": 1, "93": 3 } });
  assert.equal(m.profile.xp, 300);
  assert.deepEqual(m.profile.tiers, { "13": 2, "29": 3, "56": 1 }, "ancien format fusionné avec les paliers");
  assert.deepEqual(m.profile.stars, { "53": 2, "93": 3 });
});

test("soirée plateau en solo : tous les tours sont joués", { timeout: 60_000 }, async () => {
  const a = new Client();
  await a.open();
  a.send({ t: "hello", v: PROTOCOL_VERSION, name: "Solo" });
  await a.wait("welcome");
  a.send({ t: "create", kind: "plateau", settings: { rounds: 5, elimination: true } });
  await a.wait("room");
  a.send({ t: "start" });
  for (let i = 0; i < 3; i++) {
    const q = (await a.wait("question", (m) => m.q.index === i, 15_000)).q;
    a.send({ t: "answer", index: i, answer: perfect(q) });
    const s = (await a.wait("round", (m) => m.summary.index === i)).summary;
    assert.ok(s.nextAt, `le tour ${i + 1} doit être suivi d'un autre`);
  }
  a.ws.close();
});

test("connexion Google : fournisseurs listés, redirection avec state, retour invalide refusé", async () => {
  const prov = await (await fetch(BASE + "/api/auth/providers")).json();
  assert.deepEqual(prov.providers.map((p: { id: string }) => p.id), ["google"]);
  const r = await fetch(BASE + "/api/auth/oauth/google/start", { redirect: "manual" });
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get("location")!);
  assert.equal(loc.host, "accounts.google.com");
  assert.ok(loc.searchParams.get("state") && loc.searchParams.get("code_challenge"));
  const bad = await fetch(BASE + "/api/auth/oauth/google/callback?state=faux&code=x", { redirect: "manual" });
  assert.equal(bad.headers.get("location"), "/#oauth-erreur=expire");
  const off = await fetch(BASE + "/api/auth/oauth/discord/start", { redirect: "manual" });
  assert.equal(off.headers.get("location"), "/#oauth-erreur=indisponible");
  const link = await fetch(BASE + "/api/auth/oauth/google/start?intent=link", { redirect: "manual" });
  assert.equal(link.headers.get("location"), "/#oauth-erreur=connexion-requise");
});

function perfectFor(q: QuestionPayload) {
  const d = DEP.get(q.code)!;
  return { ...perfect(q), sousPrefectures: d.sousPrefectures, limitrophes: d.limitrophes };
}

test("handicap : niveaux par joueur, mêmes départements, points comparables", { timeout: 60_000 }, async () => {
  const a = new Client(), b = new Client();
  await Promise.all([a.open(), b.open()]);
  a.send({ t: "hello", v: PROTOCOL_VERSION, name: "Fort" }); b.send({ t: "hello", v: PROTOCOL_VERSION, name: "Debutante" });
  const wa = await a.wait("welcome"); const wb = await b.wait("welcome");
  a.send({ t: "create", kind: "duel", settings: { rounds: 3 } });
  const room = await a.wait("room");
  b.send({ t: "join", room: room.room });
  await a.wait("room", (m) => m.players.length === 2);
  b.send({ t: "level", player: wa.you, level: "expert" });
  assert.equal((await b.wait("error")).code, "not_host", "un invité ne choisit pas le niveau des autres");
  a.send({ t: "level", player: wa.you, level: "expert" });
  const st = await b.wait("room", (m) => m.players.some((p) => p.level === "expert"));
  assert.equal(st.players.find((p) => p.id === wb.you)!.level, "normal");
  a.send({ t: "start" });
  const qa = (await a.wait("question")).q, qb = (await b.wait("question")).q;
  assert.equal(qa.code, qb.code);
  assert.equal(qa.durationMs, qb.durationMs, "même temps pour tous");
  assert.ok(qa.fields.length > qb.fields.length || DEP.get(qa.code)!.sousPrefectures.length === 0, "l'expert a plus à répondre");
  a.send({ t: "answer", index: 0, answer: perfectFor(qa) });
  b.send({ t: "answer", index: 0, answer: perfect(qb) });
  const s = (await a.wait("round")).summary;
  assert.equal(s.results[wa.you].accuracy, 1);
  assert.equal(s.results[wb.you].accuracy, 1);
  assert.ok(Math.abs(s.results[wa.you].points - s.results[wb.you].points) < 40, `points normalisés : ${s.results[wa.you].points} / ${s.results[wb.you].points}`);
  a.ws.close(); b.ws.close();
});

test("en équipe : vies communes, fin quand l'équipe n'a plus de vie", { timeout: 60_000 }, async () => {
  const a = new Client(), b = new Client();
  await Promise.all([a.open(), b.open()]);
  a.send({ t: "hello", v: PROTOCOL_VERSION, name: "Un" }); b.send({ t: "hello", v: PROTOCOL_VERSION, name: "Deux" });
  await a.wait("welcome"); await b.wait("welcome");
  a.send({ t: "create", kind: "coop", settings: { rounds: 10 } });
  const room = await a.wait("room");
  assert.equal(room.kind, "coop");
  b.send({ t: "join", room: room.room });
  await a.wait("room", (m) => m.players.length === 2);
  a.send({ t: "start" });
  const q0 = (await a.wait("question")).q; await b.wait("question");
  a.send({ t: "answer", index: 0, answer: perfect(q0) });
  b.send({ t: "answer", index: 0, answer: perfect(q0) });
  const s0 = (await a.wait("round")).summary;
  assert.deepEqual([s0.team?.lives, s0.team?.lostLife], [3, false]);
  for (let i = 1; i <= 3; i++) {
    await a.wait("question", (m) => m.q.index === i, 15_000); await b.wait("question", (m) => m.q.index === i, 15_000);
    a.send({ t: "answer", index: i, answer: {} }); b.send({ t: "answer", index: i, answer: {} });
    const s = (await a.wait("round", (m) => m.summary.index === i)).summary;
    assert.equal(s.team?.lives, 3 - i);
  }
  const end = await a.wait("end", undefined, 15_000);
  assert.ok(end.team);
  assert.equal(end.team.lives, 0);
  assert.equal(end.team.stars, 0);
  a.ws.close(); b.ws.close();
});

test("défi joué en invité, rattaché au compte après inscription (une seule fois)", { timeout: 60_000 }, async () => {
  const c = new Client();
  await c.open();
  c.send({ t: "hello", v: PROTOCOL_VERSION, name: "Invite" });
  await c.wait("welcome");
  c.send({ t: "create", kind: "daily" });
  for (let i = 0; i < 10; i++) {
    const q = (await c.wait("question", (m) => m.q.index === i)).q;
    c.send({ t: "answer", index: i, answer: perfect(q) });
    await c.wait("round", (m) => m.summary.index === i);
    c.send({ t: "next" });
  }
  const end = await c.wait("end");
  assert.equal(end.daily?.saved, false);
  assert.ok(end.daily?.claim, "un jeton de rattachement est fourni à l'invité");
  c.ws.close();
  const reg = await post("/api/auth/register", { email: "claim@example.com", pseudo: "Claimer", password: "motdepasse" });
  const { token } = await reg.json();
  let r = await post("/api/daily/claim", { claim: end.daily!.claim }, token);
  assert.equal(r.status, 200);
  const { rank } = await r.json();
  assert.ok(rank.rank >= 1);
  r = await post("/api/daily/claim", { claim: end.daily!.claim }, token);
  assert.equal(r.status, 410, "jeton à usage unique");
  const me = await (await fetch(BASE + "/api/daily", { headers: { authorization: `Bearer ${token}` } })).json();
  assert.equal(me.played, true);
});

test("défi du jour par niveau : mêmes départements, questions et classement propres au niveau", { timeout: 60_000 }, async () => {
  const r = await post("/api/auth/register", { email: "decouverte@example.com", pseudo: "Novice", password: "motdepasse", home: "29" });
  const { token } = await r.json();
  const c = new Client(token);
  await c.open();
  // Profil vide : niveau Découverte ; demander Expert est ramené à son niveau (jamais au-dessus).
  c.send({ t: "hello", v: PROTOCOL_VERSION, level: "decouverte" });
  await c.wait("welcome");
  c.send({ t: "create", kind: "daily", settings: { level: "expert" } });
  for (let i = 0; i < 10; i++) {
    const q = (await c.wait("question", (m) => m.q.index === i)).q;
    assert.ok(q.hint === "nom" || q.hint === "carte", "Découverte : jamais deux inconnues");
    assert.ok(q.choices, "propositions faciles");
    if (q.fields.includes("carte")) assert.equal(q.mapChoices?.length, 4, "4 départements surlignés");
    c.send({ t: "answer", index: i, answer: perfect(q) });
    await c.wait("round", (m) => m.summary.index === i);
    c.send({ t: "next" });
  }
  const end = await c.wait("end");
  assert.equal(end.daily?.level, "decouverte");
  assert.equal(end.daily?.rank, 1, "premier de son niveau");
  const lbD = await (await fetch(BASE + "/api/daily/leaderboard?level=decouverte")).json();
  assert.ok(lbD.top.some((p: { name: string }) => p.name === "Novice"));
  assert.equal(lbD.counts.decouverte, 1);
  const lbC = await (await fetch(BASE + "/api/daily/leaderboard?level=normal")).json();
  assert.ok(!lbC.top.some((p: { name: string }) => p.name === "Novice"), "pas dans le classement Confirmé");
  const me = await (await fetch(BASE + "/api/daily", { headers: { authorization: `Bearer ${token}` } })).json();
  assert.equal(me.mine.level, "decouverte");
  c.ws.close();
});

test("salon : chacun joue à son niveau par défaut (handicap), modifiable", { timeout: 30_000 }, async () => {
  const a = new Client(), b = new Client();
  await a.open(); await b.open();
  a.send({ t: "hello", v: PROTOCOL_VERSION, name: "Debutant", level: "decouverte" });
  b.send({ t: "hello", v: PROTOCOL_VERSION, name: "Pro", level: "expert" });
  await a.wait("welcome"); await b.wait("welcome");
  a.send({ t: "create", kind: "duel" });
  const code = (await a.wait("room")).room;
  b.send({ t: "join", room: code });
  const room = await a.wait("room", (m) => m.players.length === 2);
  const lv = Object.fromEntries(room.players.map((p: { name: string; level: string }) => [p.name, p.level]));
  assert.deepEqual(lv, { Debutant: "decouverte", Pro: "expert" });
  a.send({ t: "start" });
  const qa = (await a.wait("question")).q, qb = (await b.wait("question")).q;
  assert.equal(qa.code, qb.code, "même département pour tous");
  assert.ok(qa.hint === "nom" || qa.hint === "carte");
  assert.ok(qb.fields.length >= qa.fields.length);
  a.ws.close(); b.ws.close();
});
