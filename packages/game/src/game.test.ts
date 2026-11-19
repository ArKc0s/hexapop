import { test } from "node:test";
import assert from "node:assert/strict";
import { sameName, sameCode, matchSet, normalize } from "./answer.ts";
import { makeGame, grade, fieldsFor } from "./round.ts";
import { dep, DEPARTEMENTS } from "./data.ts";
import { review, pickSession } from "./srs.ts";
import { composeSeance } from "./seance.ts";

test("noms tolérants", () => {
  assert.ok(sameName("bouches du rhone", "Bouches-du-Rhône"));
  assert.ok(sameName("Le Finistère", "Finistère"));
  assert.ok(sameName("St-Étienne", "Saint-Étienne"));
  assert.ok(sameName("Chateauroux", "Châteauroux"));
  assert.ok(sameName("Chateaurox", "Châteauroux"));
  assert.ok(!sameName("Laon", "Lyon"), "pas de tolérance sur les noms courts");
  assert.ok(!sameName("", "Paris"));
  assert.equal(normalize("L'Haÿ-les-Roses"), "hay les roses");
});

test("numéros", () => {
  assert.ok(sameCode("1", "01"));
  assert.ok(sameCode("2a", "2A"));
  assert.ok(sameCode(" 974 ", "974"));
  assert.ok(!sameCode("20", "2A"));
});

test("listes", () => {
  const r = matchSet(["brest", "morlaix", "lorient"], ["Brest", "Châteaulin", "Morlaix"]);
  assert.deepEqual(r.found, ["Brest", "Morlaix"]);
  assert.deepEqual(r.wrong, ["lorient"]);
});

test("partie complète : 101 tours, déterministe", () => {
  const a = makeGame({ seed: 42, level: "normal", input: "libre" });
  const b = makeGame({ seed: 42, level: "normal", input: "libre" });
  assert.equal(a.length, 101);
  assert.equal(new Set(a.map((q) => q.code)).size, 101);
  assert.deepEqual(a, b);
});

test("choix multiples : 4 propositions dont la bonne", () => {
  for (const q of makeGame({ seed: 7, level: "normal", input: "choix" })) {
    const d = dep(q.code);
    for (const [f, opts] of Object.entries(q.choices!)) {
      assert.equal(opts.length, 4, `${q.code} ${f}`);
      assert.equal(new Set(opts).size, 4, `${q.code} ${f} doublons`);
      const want = f === "nom" ? d.nom : f === "numero" ? d.code : d.prefecture;
      assert.ok(opts.includes(want));
    }
  }
});

test("champs selon l'indice et le niveau", () => {
  assert.deepEqual(fieldsFor(dep("29"), "nom", "normal"), ["carte", "numero", "prefecture"]);
  assert.deepEqual(fieldsFor(dep("29"), "carte", "expert"), ["nom", "numero", "prefecture", "sousPrefectures", "limitrophes"]);
  assert.deepEqual(fieldsFor(dep("976"), "carte", "expert"), ["nom", "numero", "prefecture"]);
});

test("notation et bonus vitesse", () => {
  const q = { index: 0, code: "29", hint: "nom" as const, fields: fieldsFor(dep("29"), "nom", "normal"), durationMs: 20000 };
  const perfectFast = grade(q, { carte: "29", numero: "29", prefecture: "quimper", elapsedMs: 0 });
  assert.equal(perfectFast.points, 600);
  const perfectSlow = grade(q, { carte: "29", numero: "29", prefecture: "quimper", elapsedMs: 20000 });
  assert.equal(perfectSlow.points, 300);
  const partial = grade(q, { carte: "29", numero: "29", prefecture: "Brest", elapsedMs: 10000 });
  assert.equal(partial.points, 300);
  assert.equal(partial.accuracy, 2 / 3);
});

test("répétition espacée", () => {
  let s = review(undefined, 1, 0);
  assert.equal(s.box, 1);
  s = review(s, 1, 0); assert.equal(s.box, 2);
  s = review(s, 0, 0); assert.equal(s.box, 0);
  const all = DEPARTEMENTS.map((d) => d.code);
  const pick = pickSession({ "13": { box: 0, due: 0, seen: 1, correct: 0 } }, all, 10, 1000, 8);
  assert.equal(pick[0], "13");
  assert.equal(pick.length, 10);
});

import { isFading } from "./srs.ts";
test("un département pâlit quand sa révision est très en retard", () => {
  const DAY = 86_400_000;
  const p = { "29": { box: 1, due: 0, seen: 1, correct: 1 }, "13": { box: 6, due: 0, seen: 9, correct: 9 } };
  assert.equal(isFading(p, "29", DAY / 2), false);
  assert.equal(isFading(p, "29", 2 * DAY), true);
  assert.equal(isFading(p, "13", 30 * DAY), false, "connaissance solide : tient plus longtemps");
  assert.equal(isFading(p, "13", 61 * DAY), true);
  assert.equal(isFading(p, "75", 1e12), false);
});

test("entraînement : on te donne / on te demande, sans chrono", async () => {
  const { playable } = await import("./round.ts");
  // On me donne le nom, je le place : une seule chose à trouver, jamais l'indice.
  const qs = makeGame({ seed: 7, level: "normal", input: "choix", hints: ["nom"], ask: ["carte"], durationMs: 0, switchable: true });
  assert.equal(qs.length, 101);
  for (const q of qs) {
    assert.equal(q.hint, "nom");
    assert.deepEqual(q.fields, ["carte"]);
    assert.equal(q.mapChoices?.length, 4);
    assert.ok(q.mapChoices!.includes(q.code));
    assert.equal(new Set(q.mapChoices).size, 4);
  }
  // Sans chrono : pas de bonus de vitesse, les points ne dépendent que de la justesse.
  const r = grade(qs[0], { carte: qs[0].code, elapsedMs: 999_999 });
  assert.equal(r.accuracy, 1);
  assert.equal(r.points, 100);
  // Indice préfecture ; l'indice n'est jamais demandé.
  const p = makeGame({ seed: 3, level: "normal", input: "libre", hints: ["prefecture", "carte"], ask: ["carte", "nom", "prefecture"], rounds: 40, durationMs: 0 });
  for (const q of p) assert.ok(!q.fields.includes(q.hint as never) && q.fields.length > 0);
  assert.ok(p.some((q) => q.hint === "prefecture"));
  // Voisins demandés mais absents (outre-mer) : on retombe sur un autre champ ou on l'ignore, jamais un tour vide.
  const om = makeGame({ seed: 1, level: "expert", input: "libre", hints: ["nom"], ask: ["limitrophes", "numero"], codes: ["971", "29"], durationMs: 0 });
  for (const q of om) assert.ok(q.fields.length > 0);
  assert.equal(playable(["nom"], ["nom"]), false);
  assert.equal(playable(["nom", "carte"], ["nom"]), true);
});

test("le défi et les salons ne changent pas (tirages identiques sans switchable)", () => {
  const a = makeGame({ seed: 42, level: "normal", input: "choix", rounds: 10 });
  assert.ok(a.every((q) => !q.mapChoices));
  assert.deepEqual(a.map((q) => q.code), makeGame({ seed: 42, level: "normal", input: "choix", rounds: 10 }).map((q) => q.code));
});

test("Découverte : mêmes départements, jamais deux inconnues, propositions faciles", () => {
  const base = { seed: 4242, input: "libre" as const, rounds: 10 };
  const normal = makeGame({ ...base, level: "normal" });
  const decouverte = makeGame({ ...base, level: "decouverte" });
  const expert = makeGame({ ...base, level: "expert" });
  assert.deepEqual(decouverte.map((q) => q.code), normal.map((q) => q.code), "les mêmes 10 départements pour tout le monde");
  assert.deepEqual(expert.map((q) => q.code), normal.map((q) => q.code));
  for (const q of decouverte) {
    assert.ok(q.hint === "nom" || q.hint === "carte", "indice connaissable");
    assert.ok(q.easy && q.choices && Object.keys(q.choices).length > 0);
    if (q.fields.includes("carte")) assert.equal(q.mapChoices?.length, 4);
    assert.ok(!q.fields.includes("sousPrefectures"));
  }
  assert.equal(decouverte[0].durationMs, 20_000);
});

test("préfecture : variantes acceptées (Cergy, Cergy-Pontoise pour le 95)", () => {
  const q = makeGame({ seed: 1, level: "normal", input: "libre", plan: [{ code: "95", hint: "nom", ask: ["prefecture"] }] })[0];
  for (const p of ["Pontoise", "Cergy", "cergy pontoise", "Cergy-Pontoise"]) assert.equal(grade(q, { prefecture: p, elapsedMs: 0 }).accuracy, 1, p);
  assert.equal(grade(q, { prefecture: "Argenteuil", elapsedMs: 0 }).accuracy, 0);
});

test("séance de révisions : les départements à revoir ne sortent pas dans l'ordre des numéros", () => {
  const now = Date.now();
  const card = { b: 2, d: now - 1000, s: 1 as const, v: 1 as const };
  const codes = ["74", "75", "76", "78", "80", "81", "82", "83", "84", "85", "86", "87"];
  const know = Object.fromEntries(codes.map((c) => [c, { carte: card, numero: card, prefecture: card }]));
  const orders = new Set<string>();
  for (let seed = 1; seed <= 5; seed++) {
    const s = composeSeance(know, { now, seed, start: "29", kind: "revision" });
    const got = s.plan.map((p) => p.code);
    assert.equal(new Set(got).size, got.length);
    orders.add(got.join(","));
    assert.notEqual(got.join(","), [...got].sort().join(","), `graine ${seed} : ordre des numéros`);
  }
  assert.ok(orders.size > 1, "l'ordre change d'une séance à l'autre");
});

test("séance de consolidation : pas l'ordre des numéros non plus", () => {
  const now = Date.now();
  const card = { b: 3, d: now + 86_400_000 * 5, s: 1 as const, v: 1 as const }; // rien à réviser
  const know = Object.fromEntries(DEPARTEMENTS.filter((d) => !d.outreMer).map((d) => [d.code, { carte: card, numero: card, prefecture: card }]));
  const got = composeSeance(know, { now, seed: 3, start: "29" }).plan.map((p) => p.code);
  assert.ok(got.length > 4);
  assert.notEqual(got.join(","), [...got].sort().join(","), got.join(" "));
});

test("tirage : les départements récents reviennent moins vite, mais peuvent revenir", () => {
  // Comme le défi du jour : 10 sur 101, en se souvenant des 11 jours précédents.
  const days: string[][] = [];
  for (let d = 0; d < 400; d++) {
    const recent: Record<string, number> = {};
    for (let k = 1; k <= 11 && d - k >= 0; k++) for (const c of days[d - k]) recent[c] ??= k;
    days.push(makeGame({ seed: 1000 + d * 7919, level: "normal", input: "libre", rounds: 10, recent }).map((q) => q.code));
  }
  let common = 0, withCommon = 0, distinct = 0;
  for (let d = 1; d < days.length; d++) { const n = days[d].filter((c) => days[d - 1].includes(c)).length; common += n; if (n) withCommon++; }
  for (let d = 0; d + 7 <= days.length; d++) distinct += new Set(days.slice(d, d + 7).flat()).size;
  const avg = common / (days.length - 1), week = distinct / (days.length - 6);
  assert.ok(avg < 0.5, `en commun avec la veille : ${avg}`); // au hasard pur : environ 1
  assert.ok(withCommon > 20, "un département de la veille revient quand même de temps en temps");
  assert.ok(week > 58, `départements différents sur 7 jours : ${week}`); // au hasard pur : environ 52
  for (const d of days) assert.equal(new Set(d).size, 10);
  // Même graine, même mémoire : même tirage (tous les joueurs ont le même défi).
  const cfg = { seed: 42, level: "normal" as const, input: "libre" as const, rounds: 10, recent: { "48": 1, "23": 2 } };
  assert.deepEqual(makeGame(cfg).map((q) => q.code), makeGame(cfg).map((q) => q.code));
  // Sans mémoire : exactement le tirage d'avant (les défis passés ne changent pas).
  const old = { seed: 7, level: "normal" as const, input: "libre" as const, rounds: 10 };
  assert.deepEqual(makeGame(old).map((q) => q.code), makeGame({ ...old, recent: {} }).map((q) => q.code));
});
