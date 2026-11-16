import { test } from "node:test";
import assert from "node:assert/strict";
process.env.DB_PATH = ":memory:";
const { decide, validEndpoint, DEFAULT_PREFS, cleanPrefs } = await import("./push.ts");

const base = { last_played_day: "2026-11-15", streak: 1, fading: 0, comeback_stage: 0, last_sent_day: null as string | null };
const D = "2026-11-16";

test("rappel du défi à l'heure choisie, pas avant, pas si déjà joué ou déjà notifié", () => {
  assert.equal(decide(base, DEFAULT_PREFS, D, 17), null);
  assert.equal(decide(base, DEFAULT_PREFS, D, 18)?.msg.tag, "defi");
  assert.equal(decide({ ...base, last_played_day: D }, DEFAULT_PREFS, D, 19), null);
  assert.equal(decide({ ...base, last_sent_day: D }, DEFAULT_PREFS, D, 19), null);
  assert.equal(decide(base, { ...DEFAULT_PREFS, daily: false }, D, 19), null);
});

test("série en danger : attend 20 h, remplace le rappel du défi", () => {
  const s = { ...base, streak: 6 };
  assert.equal(decide(s, DEFAULT_PREFS, D, 18), null);
  const m = decide(s, DEFAULT_PREFS, D, 20);
  assert.equal(m?.msg.tag, "serie");
  assert.match(m!.msg.title, /6 jours/);
});

test("retour en douceur : 4 jours puis 10 jours, puis plus rien ; pas de rappel du défi aux inactifs", () => {
  const four = { ...base, last_played_day: "2026-11-12", fading: 5 };
  const a = decide(four, DEFAULT_PREFS, D, 18);
  assert.equal(a?.msg.tag, "retour"); assert.equal(a?.stage, 1); assert.match(a!.msg.body, /5 départements/);
  assert.equal(decide({ ...four, comeback_stage: 1 }, DEFAULT_PREFS, D, 18), null, "déjà relancé à ce stade");
  const ten = { ...base, last_played_day: "2026-11-05", comeback_stage: 1 };
  assert.equal(decide(ten, DEFAULT_PREFS, D, 18)?.stage, 2);
  assert.equal(decide({ ...ten, comeback_stage: 2 }, DEFAULT_PREFS, D, 18), null, "plus rien après le 2e rappel");
});

test("adresses d'abonnement : seulement les services officiels en https (anti-SSRF)", () => {
  assert.ok(validEndpoint("https://fcm.googleapis.com/fcm/send/abc"));
  assert.ok(validEndpoint("https://web.push.apple.com/QGx"));
  assert.ok(validEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x"));
  assert.ok(!validEndpoint("http://fcm.googleapis.com/x"));
  assert.ok(!validEndpoint("https://192.168.1.10/x"));
  assert.ok(!validEndpoint("https://evil.com/fcm.googleapis.com"));
  assert.ok(!validEndpoint("https://fcm.googleapis.com.evil.com/x"));
  assert.deepEqual(cleanPrefs({ hour: 3, daily: false }), { daily: false, hour: 7, streak: true, comeback: true });
});
