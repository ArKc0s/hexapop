import { test } from "node:test";
import assert from "node:assert/strict";
import { sameName, sameCode, matchSet, normalize } from "./answer.ts";
import { makeGame, grade, fieldsFor } from "./round.ts";
import { dep, DEPARTEMENTS } from "./data.ts";
import { review, pickSession } from "./srs.ts";

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
