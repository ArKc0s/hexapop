import { test } from "node:test";
import assert from "node:assert/strict";
import { applyGame, emptyProfile, levelInfo, mergeProfiles, questsFor, sanitizeProfile, starsFor, tourState, TOUR_REGIONS, TOUR, OUTRE_MER, nextTourRegion, combos, liveStreak, type GameReport } from "./meta.ts";
import type { RoundResult } from "./round.ts";

const T = (day: string, h = 12) => Date.parse(`${day}T${String(h).padStart(2, "0")}:00:00+01:00`);
const res = (code: string, acc: number, ms = 4000): RoundResult => ({ code, accuracy: acc, points: 0, elapsedMs: ms, fields: [{ field: "nom", score: acc, expected: "" }, { field: "prefecture", score: acc, expected: "" }] });
const report = (over: Partial<GameReport>): GameReport => ({ mode: "eclair", level: "normal", results: [], now: T("2026-11-16"), ...over });

test("niveaux", () => {
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(99).level, 1);
  assert.equal(levelInfo(100).level, 2);
  assert.equal(levelInfo(300).level, 3);
  assert.equal(levelInfo(150).ratio, 0.25);
});

test("régions du Tour : 13 + outre-mer, voisinages symétriques, Corse reliée", () => {
  assert.equal(TOUR_REGIONS.length, 14);
  for (const r of TOUR_REGIONS) for (const n of r.neighbors) assert.ok(TOUR.get(n)!.neighbors.includes(r.code), `${r.nom} ↔ ${n}`);
  const corse = TOUR_REGIONS.find((r) => r.deps.includes("2A"))!;
  assert.equal(corse.neighbors.length, 1);
  assert.equal(TOUR.get(OUTRE_MER)!.deps.length, 5);
});

test("Tour : déblocage par voisinage, outre-mer à 20 étoiles", () => {
  const p = emptyProfile();
  const bzh = TOUR_REGIONS.find((r) => r.deps.includes("29"))!.code;
  const pdl = TOUR_REGIONS.find((r) => r.deps.includes("44"))!.code;
  const ge = TOUR_REGIONS.find((r) => r.deps.includes("67"))!.code;
  assert.equal(tourState(p, ge), "open", "sans départ choisi, tout est ouvert");
  const { profile } = applyGame(p, report({ mode: "tour", region: bzh, results: TOUR.get(bzh)!.deps.map((c) => res(c, 1)) }));
  assert.equal(profile.tourStart, bzh);
  assert.equal(profile.stars[bzh], 2);
  assert.equal(tourState(profile, pdl), "open");
  assert.equal(tourState(profile, ge), "locked");
  assert.equal(tourState(profile, OUTRE_MER), "locked");
  assert.equal(starsFor("expert", 0.92), 3);
  assert.equal(starsFor("normal", 0.7), 1);
  assert.equal(starsFor("normal", 0.5), 0);
  assert.ok(nextTourRegion(profile));
});

test("XP, combos, plaques, badges", () => {
  const rs = [res("29", 1, 1200), res("2A", 1), res("2B", 1), res("13", 0.5), res("75", 1)];
  assert.deepEqual(combos(rs), [1, 2, 3, 0, 1]);
  const { profile, rewards } = applyGame(emptyProfile(), report({ results: rs }));
  assert.deepEqual(rewards.newPlates.sort(), ["29", "2A", "2B", "75"].sort());
  for (const b of ["premier", "bout-du-monde", "tour-de-corse", "eclair"]) assert.ok(rewards.newBadges.includes(b), b);
  assert.ok(rewards.xp > 0 && profile.xp === rewards.xp);
  assert.equal(rewards.streak.count, 1);
});

test("série : +1 le lendemain, joker pour un jour manqué, remise à 1 sinon", () => {
  let p = applyGame(emptyProfile(), report({ results: [res("01", 1)], now: T("2026-11-16") })).profile;
  p = applyGame(p, report({ results: [res("01", 1)], now: T("2026-11-16", 20) })).profile;
  assert.equal(p.streak.count, 1, "même jour");
  p = applyGame(p, report({ results: [res("01", 1)], now: T("2026-11-17") })).profile;
  assert.equal(p.streak.count, 2);
  const j = applyGame(p, report({ results: [res("01", 1)], now: T("2026-11-19") }));
  assert.equal(j.profile.streak.count, 3);
  assert.equal(j.rewards.streak.jokerUsed, true);
  const k = applyGame(j.profile, report({ results: [res("01", 1)], now: T("2026-11-21") }));
  assert.equal(k.profile.streak.count, 1, "plus de joker cette semaine");
  assert.equal(liveStreak(j.profile, T("2026-11-20")), 3);
});

test("quêtes : 3 par jour, déterministes, familles distinctes", () => {
  const q = questsFor("2026-11-16");
  assert.equal(q.length, 3);
  assert.deepEqual(q.map((x) => x.id), questsFor("2026-11-16").map((x) => x.id));
  assert.equal(new Set(q.map((x) => x.id.replace(/\d+$/, ""))).size, 3);
});

test("fusion et nettoyage de profils", () => {
  const a = applyGame(emptyProfile(), report({ results: [res("29", 1)] })).profile;
  const b = applyGame(emptyProfile(), report({ results: [res("13", 1), res("69", 1)] })).profile;
  const m = mergeProfiles(a, b);
  assert.deepEqual(m.plates.sort(), ["13", "29", "69"]);
  assert.equal(m.xp, Math.max(a.xp, b.xp));
  const s = sanitizeProfile({ xp: -5, plates: ["29", "XX", 3], stars: { "53": 9, nope: 2 }, badges: { fake: 1, premier: 5 } });
  assert.equal(s.xp, 0);
  assert.deepEqual(s.plates, ["29"]);
  assert.deepEqual(s.stars, { "53": 3 });
  assert.deepEqual(Object.keys(s.badges), ["premier"]);
});
