import { test } from "node:test";
import assert from "node:assert/strict";
import { applyGame, emptyProfile, levelInfo, mergeProfiles, questsFor, sanitizeProfile, starsFor, tourState, TOUR_REGIONS, TOUR, OUTRE_MER, nextTourRegion, combos, liveStreak, type GameReport } from "./meta.ts";
import type { RoundResult } from "./round.ts";

const T = (day: string, h = 12) => Date.parse(`${day}T${String(h).padStart(2, "0")}:00:00+01:00`);
const res = (code: string, acc: number, ms = 4000): RoundResult => ({ code, accuracy: acc, points: 0, elapsedMs: ms, fields: [{ field: "nom", score: acc, expected: "" }, { field: "prefecture", score: acc, expected: "" }] });
const report = (over: Partial<GameReport>): GameReport => ({ mode: "eclair", level: "normal", input: "choix", results: [], now: T("2026-11-16"), ...over });

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
  assert.equal(rewards.knowledge, null, "partie sans apprentissage : pas d'étoiles");
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
  const m = mergeProfiles({ ...a, tiers: { "29": 1 } }, { ...b, tiers: { "13": 2, "69": 1 } });
  assert.deepEqual(Object.keys(m.tiers).sort(), ["13", "29", "69"]);
  assert.equal(m.xp, Math.max(a.xp, b.xp));
  const s = sanitizeProfile({ xp: -5, plates: ["29", "XX", 3], tiers: { "13": 7, "ZZ": 2 }, stars: { "53": 9, nope: 2 }, badges: { fake: 1, premier: 5 } });
  assert.equal(s.xp, 0);
  assert.deepEqual(s.tiers, { "29": 1, "13": 3 }, "ancien format converti en bronze, paliers bornés");
  assert.deepEqual(s.stars, { "53": 3 });
  assert.deepEqual(Object.keys(s.badges), ["premier"]);
});

test("étoiles : sans aide, avec aide, médailles, fusion et reprise des anciens profils", async () => {
  const K = await import("./knowledge.ts");
  const R = (code: string, scores: Record<string, number>): RoundResult => ({ code, accuracy: 1, points: 0, elapsedMs: 3000, fields: Object.entries(scores).map(([field, score]) => ({ field: field as never, score, expected: "" })) });
  // On donne le nom : placer + numéro + préfecture. Numéro en propositions (aidé), le reste au clavier / carte entière.
  let { profile, rewards } = applyGame(emptyProfile(), report({ learn: true, results: [R("29", { carte: 1, numero: 1, prefecture: 1 })], rounds: [{ hint: "nom", fields: ["carte", "numero", "prefecture"], aided: ["numero"] }] }));
  assert.deepEqual(rewards.knowledge!.stars.map((s) => s.facet).sort(), ["carte", "prefecture"]);
  assert.equal(K.starsOf(profile.know!, "29"), 2);
  assert.equal(profile.know!["29"].numero!.v, 1, "vu en propositions, sans étoile");
  // Le numéro au clavier : 3 étoiles, médaille de bronze.
  ({ profile, rewards } = applyGame(profile, report({ learn: true, results: [R("29", { numero: 1 })], rounds: [{ hint: "nom", fields: ["numero"], aided: [] }] })));
  assert.deepEqual(rewards.knowledge!.medals, [{ code: "29", medal: 1 }]);
  assert.equal(K.taFrance(profile.know!), 0, "3 étoiles sur 303 = 0 %");
  assert.equal(K.playerLevel(profile.know!), "decouverte");
  // Indice numéro, on demande le nom : c'est la facette numéro qui est révisée. Une erreur ne retire jamais l'étoile.
  ({ profile } = applyGame(profile, report({ learn: true, results: [R("29", { nom: 0 })], rounds: [{ hint: "numero", fields: ["nom"], aided: [] }] })));
  assert.equal(profile.know!["29"].numero!.b, 0);
  assert.equal(profile.know!["29"].numero!.s, 1);
  // Argent : boîte 4 sur les trois facettes ; or : + sous-préfectures et voisins.
  const solid = (s: 0 | 1 = 1) => ({ b: 4, d: 0, s, v: 1 as const });
  const k = { "29": { carte: solid(), numero: solid(), prefecture: solid() } };
  assert.equal(K.medalOf(k, "29"), 2);
  assert.equal(K.medalOf({ "29": { ...k["29"], sousPrefectures: solid(), limitrophes: solid() } }, "29"), 3);
  assert.equal(K.tarnished(k, "29", 30 * 86_400_000), true, "révision très en retard : médaille ternie");
  // Fusion : étoile gardée, révision la plus récente.
  const m = K.mergeKnowledge({ "29": { carte: { b: 1, d: 10, s: 1, v: 1 } } }, { "29": { carte: { b: 3, d: 20, s: 0, v: 1 } } });
  assert.deepEqual(m["29"].carte, { b: 3, d: 20, s: 1, v: 1 });
  // Partie hors apprentissage (défi) : aucune étoile.
  const d = applyGame(emptyProfile(), report({ mode: "daily", results: [R("13", { carte: 1 })], rounds: [{ hint: "nom", fields: ["carte"], aided: [] }] }));
  assert.equal(d.profile.know, undefined);
  // Reprise : boîte ≥ 4 ou vignette argent → 3 étoiles (bronze) ; vu → « vu » ; or → étoiles expert.
  const mig = K.migrateKnowledge({ "13": { box: 5, due: 0, seen: 3, correct: 3 }, "69": { box: 1, due: 0, seen: 1, correct: 0 } }, { "75": 2, "29": 3 }, 0);
  assert.equal(K.medalOf(mig, "13"), 1);
  assert.equal(K.starsOf(mig, "69"), 0);
  assert.equal(mig["69"].carte!.v, 1);
  assert.equal(K.starsOf(mig, "75"), 3);
  assert.equal(mig["29"].limitrophes!.s, 1);
  // Nettoyage : codes et facettes inconnus ignorés, valeurs bornées.
  const s = sanitizeProfile({ know: { "29": { carte: { b: 99, d: -1, s: 7 }, nope: { b: 1 } }, XX: {} } });
  assert.deepEqual(s.know, { "29": { carte: { b: 6, d: 0, s: 1, v: 0 } } });
});

test("séance Continuer : découverte, révisions, consolidation, jamais deux inconnues", async () => {
  const S = await import("./seance.ts");
  const { makeGame } = await import("./round.ts");
  const now = T("2026-11-17");
  // Nouveau joueur du Finistère : sa région (Bretagne), 3 départements montrés puis demandés facette par facette.
  const s0 = S.composeSeance({}, { now, seed: 1, start: "53" });
  assert.equal(s0.region?.code, "53");
  assert.equal(s0.discover.length, 3);
  assert.equal(s0.plan.length, 12);
  assert.ok(s0.plan.slice(0, 9).every((it) => it.teach && it.easy && it.hint === "nom" && it.ask.length === 1));
  // Rappel en fin de séance : fiche complète sans aide facile, qui donne les premières étoiles.
  assert.ok(s0.plan.slice(9).every((it) => !it.teach && !it.easy && it.ask.length === 3 && s0.discover.includes(it.code)));
  const qs = makeGame({ seed: 2, level: "normal", input: "choix", switchable: true, plan: s0.plan });
  assert.ok(qs.slice(0, 9).every((q) => q.teach && q.easy && q.durationMs === 0));
  assert.ok(qs.filter((q) => q.fields[0] === "carte").every((q) => q.mapChoices!.length === 4));
  // Joueur avancé : révisions échues d'abord, puis la région suivante (pas finie).
  const solid = { b: 2, d: now - 1, s: 1 as const, v: 1 as const };
  const k: Record<string, Record<string, typeof solid>> = {};
  for (const c of ["22", "29", "35", "56"]) k[c] = { carte: solid, numero: solid, prefecture: solid };
  const s1 = S.composeSeance(k, { now, seed: 3, start: "53" });
  assert.ok(s1.reviews >= 1 && s1.reviews <= 5);
  assert.notEqual(s1.region?.code, "53", "Bretagne finie : on passe à une voisine");
  assert.ok(TOUR.get("53")!.neighbors.includes(s1.region!.code));
  // Un département revient une seule fois, sauf ceux qu'on découvre (montrés facette par facette).
  const others = s1.plan.filter((x) => !s1.discover.includes(x.code)).map((x) => x.code);
  assert.equal(new Set(others).size, others.length);
  for (const c of s1.discover) assert.equal(s1.plan.filter((x) => x.code === c).length, 4);
  assert.ok(s1.plan.length <= 12);
  // Région choisie par le joueur sur la carte.
  assert.equal(S.currentRegion(k, "53", "84")?.code, "84");
  // Rien à revoir ni à découvrir dans une région finie choisie : on retombe sur l'ordre normal.
  assert.notEqual(S.currentRegion(k, "53", "53")?.code, "53");
});

test("kilomètres de la semaine, parties du jour, quêtes retirées", () => {
  let { profile, rewards } = applyGame(emptyProfile(), report({ results: [res("29", 1)], now: T("2026-11-17") }));
  assert.equal(profile.week?.km, rewards.xp);
  assert.equal(profile.today?.games, 1);
  assert.deepEqual(rewards.questsDone, []);
  ({ profile } = applyGame(profile, report({ results: [res("29", 1)], now: T("2026-11-17", 18) })));
  assert.equal(profile.today?.games, 2);
  ({ profile, rewards } = applyGame(profile, report({ results: [res("29", 1)], now: T("2026-11-24") })));
  assert.equal(profile.week?.km, rewards.xp, "nouvelle semaine");
  assert.equal(profile.today?.games, 1);
  const s = sanitizeProfile({ home: "29", focus: "53", week: { id: "2026-11-16", km: 12 }, today: { day: "nope", games: 3 } });
  assert.equal(s.home, "29"); assert.equal(s.focus, "53"); assert.equal(s.week?.km, 12); assert.equal(s.today, undefined);
});
