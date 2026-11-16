import { test } from "node:test";
import assert from "node:assert/strict";
process.env.DB_PATH = ":memory:";
const { db } = await import("./db.ts");
const { resolveIdentity } = await import("./api.ts");
const { createSession, hashPassword } = await import("./auth.ts");

const id = (subject: string, email: string | null, emailVerified = true, name: string | null = "Léo") => ({ subject, email, emailVerified, name });
const user = (uid: number) => db.prepare("SELECT * FROM users WHERE id = ?").get(uid) as { pseudo: string; pass_hash: string; email_verified: number };

test("nouveau joueur : compte créé, email vérifié, sans mot de passe", () => {
  const r = resolveIdentity("google", id("g-1", "Nouveau@Example.com"));
  assert.equal(r.created, true);
  const u = user(r.userId);
  assert.equal(u.pass_hash, "");
  assert.equal(u.email_verified, 1);
  assert.equal(resolveIdentity("google", id("g-1", "nouveau@example.com")).userId, r.userId, "même identité, même compte");
});

test("pseudo déjà pris : suffixe automatique", () => {
  const a = resolveIdentity("discord", id("d-1", "a@example.com", true, "Léo"));
  const b = resolveIdentity("discord", id("d-2", "b@example.com", true, "Léo"));
  assert.notEqual(user(a.userId).pseudo, user(b.userId).pseudo);
});

test("compte existant confirmé : liaison automatique, mot de passe conservé", async () => {
  const { lastInsertRowid } = db.prepare("INSERT INTO users (email, pseudo, pass_hash, email_verified, created_at) VALUES ('ok@example.com', 'Verif', ?, 1, 0)").run(await hashPassword("motdepasse"));
  const r = resolveIdentity("twitch", id("t-1", "OK@example.com"));
  assert.equal(r.userId, Number(lastInsertRowid));
  assert.equal(r.linked, true);
  assert.notEqual(user(r.userId).pass_hash, "");
});

test("compte existant jamais confirmé : lié, mais mot de passe et sessions annulés", async () => {
  const { lastInsertRowid } = db.prepare("INSERT INTO users (email, pseudo, pass_hash, email_verified, created_at) VALUES ('piege@example.com', 'Piege', ?, 0, 0)").run(await hashPassword("motdepasse"));
  const uid = Number(lastInsertRowid);
  createSession(uid);
  const r = resolveIdentity("google", id("g-2", "piege@example.com"));
  assert.equal(r.userId, uid);
  assert.equal(user(uid).pass_hash, "");
  assert.equal(user(uid).email_verified, 1);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?").get(uid) as { n: number }).n, 0);
});

test("email non vérifié chez le fournisseur : refusé", () => {
  assert.throws(() => resolveIdentity("discord", id("d-9", "x@example.com", false)), /pas vérifié/);
  assert.throws(() => resolveIdentity("discord", id("d-10", null)), /pas vérifié/);
});
