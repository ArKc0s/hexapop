import { test } from "node:test";
import assert from "node:assert/strict";
import { NEW_SKILL, difficulty, updateSkill } from "./skill.ts";
import { emptyProfile, mergeProfiles, sanitizeProfile } from "./meta.ts";
import { sameName, sameCode, matchSet, normalize } from "./answer.ts";
import { makeGame, grade, fieldsFor } from "./round.ts";
import { dep, DEPARTEMENTS, REGION_ITEMS, WORLD_ITEMS } from "./data.ts";
import { composeSeance } from "./seance.ts";
import { medalOf, taFrance } from "./knowledge.ts";
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

test("atlas Régions : 18 régions, codes à part, séances et questions sans numéro", () => {
  assert.equal(REGION_ITEMS.length, 18);
  const bzh = dep("R53");
  assert.equal(bzh.nom, "Bretagne");
  assert.equal(bzh.prefecture, "Rennes");
  assert.deepEqual(bzh.limitrophes, ["R28", "R52"]);
  assert.equal(bzh.sousPrefectures.length, 4);
  assert.equal(dep("11").nom, "Aude", "la région 11 ne se mélange pas avec l'Aude");
  assert.equal(dep("R01").sousPrefectures.length, 0, "outre-mer : pas d'expert « ses départements »");
  // Séance : seulement des régions, de la métropole d'abord, jamais de numéro demandé.
  const s = composeSeance({}, { now: Date.now(), seed: 3, start: "29", atlas: "regions" });
  assert.equal(s.region?.code, "RM");
  assert.ok(s.plan.length > 0 && s.plan.every((it) => it.code.startsWith("R") && !it.ask.includes("numero")));
  // Partie libre : les 18, jamais le numéro.
  const qs = makeGame({ seed: 1, level: "normal", input: "libre", atlas: "regions" });
  assert.equal(qs.length, 18);
  assert.ok(qs.every((q) => q.code.startsWith("R") && !q.fields.includes("numero") && q.hint !== "numero"));
  // Expert « ses départements » : par le nom ou le numéro.
  const q = { index: 0, code: "R53", hint: "nom" as const, fields: ["sousPrefectures" as const], durationMs: 0 };
  assert.equal(grade(q, { sousPrefectures: ["29", "Morbihan", "35", "côtes d'armor"], elapsedMs: 0 }).accuracy, 1);
  // Étoiles et médailles : 2 facettes de base par région.
  const now = Date.now();
  const card = { b: 5, d: now + 1e9, s: 1 as const, v: 1 as const };
  const know = { R53: { carte: card, prefecture: card } };
  assert.equal(medalOf(know, "R53"), 2, "argent avec 2 étoiles retenues ; l'or demande l'expert");
  assert.equal(taFrance(know, "regions"), Math.floor((2 / 36) * 100));
  assert.equal(taFrance(know), 0, "les régions ne comptent pas dans les départements");
});

test("atlas Monde : 195 pays, capitales, drapeaux toujours en propositions", () => {
  assert.equal(WORLD_ITEMS.length, 195);
  const fr = dep("WFRA");
  assert.equal(fr.prefecture, "Paris");
  assert.ok(fr.limitrophes.includes("WESP") && fr.limitrophes.includes("WBRA"), "la Guyane touche le Brésil");
  assert.equal(dep("WJPN").limitrophes.length, 0);
  assert.equal(dep("WCOD").region, "WAF");
  // Autres noms et autres capitales acceptés.
  const q = { index: 0, code: "WCOD", hint: "carte" as const, fields: ["nom" as const], durationMs: 0 };
  assert.equal(grade(q, { nom: "RDC", elapsedMs: 0 }).accuracy, 1);
  const qb = { index: 0, code: "WBOL", hint: "nom" as const, fields: ["prefecture" as const], durationMs: 0 };
  assert.equal(grade(qb, { prefecture: "la paz", elapsedMs: 0 }).accuracy, 1);
  // Capitales contestées : demandées, réponses défendables acceptées, note factuelle.
  const qi = { index: 0, code: "WISR", hint: "nom" as const, fields: ["prefecture" as const], durationMs: 0 };
  assert.equal(grade(qi, { prefecture: "Jérusalem", elapsedMs: 0 }).accuracy, 1);
  assert.equal(grade(qi, { prefecture: "Tel Aviv", elapsedMs: 0 }).accuracy, 1);
  assert.equal(grade({ ...qi, code: "WPSX" }, { prefecture: "Ramallah", elapsedMs: 0 }).accuracy, 1);
  assert.ok(dep("WISR").prefNote && dep("WPSX").prefNote);
  // Propositions de capitale : des villes du pays (Abidjan face à Yamoussoukro), jamais une autre réponse acceptée.
  const civ = makeGame({ seed: 2, level: "normal", input: "choix", atlas: "monde", codes: ["WCIV"], hints: ["nom"], ask: ["prefecture"] })[0];
  assert.ok(civ.choices?.prefecture?.includes("Yamoussoukro"));
  assert.ok(civ.choices!.prefecture!.every((c) => c === "Yamoussoukro" || dep("WCIV").villes!.includes(c)));
  assert.ok(!dep("WISR").villes!.includes("Tel Aviv"), "Tel-Aviv est acceptée : jamais un piège");
  // Séance : l'Europe d'abord, des pays seulement.
  const s = composeSeance({}, { now: Date.now(), seed: 3, start: "29", atlas: "monde" });
  assert.equal(s.region?.code, "WEU");
  assert.ok(s.plan.every((it) => it.code.startsWith("W")));
  // Au clavier, le drapeau a quand même ses 4 propositions (des codes de pays, dont le bon).
  const qs = makeGame({ seed: 4, level: "normal", input: "libre", atlas: "monde", rounds: 40 });
  const withFlag = qs.filter((x) => x.fields.includes("drapeau"));
  assert.ok(withFlag.length > 0);
  for (const x of withFlag) { assert.equal(x.choices?.drapeau?.length, 4); assert.ok(x.choices!.drapeau!.includes(x.code)); }
  assert.ok(qs.some((x) => x.hint === "drapeau"));
  const g = withFlag[0];
  assert.equal(grade({ ...g, fields: ["drapeau"] }, { drapeau: g.code, elapsedMs: 0 }).accuracy, 1);
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

test("séances enchaînées : les pays vus il y a quelques minutes ne reviennent pas tant qu'il reste à découvrir", () => {
  const now = Date.now();
  // Trois pays d'Europe vus il y a 10 minutes (étoiles gagnées, prochaine révision dans un jour).
  const card = { b: 2, d: now - 10 * 60_000 + 86_400_000, s: 1 as const, v: 1 as const };
  const know = Object.fromEntries(["WBEL", "WESP", "WGBR"].map((c) => [c, { carte: card, prefecture: card, drapeau: card }]));
  const s = composeSeance(know, { now, seed: 5, start: "29", atlas: "monde" });
  assert.equal(s.region?.code, "WEU");
  const codes = s.plan.map((p) => p.code);
  assert.ok(!codes.some((c) => ["WBEL", "WESP", "WGBR"].includes(c)), codes.join(" "));
  assert.ok(s.discover.length >= 4, "on découvre plutôt de nouveaux pays");
  // Deux heures plus tard, ils peuvent revenir en consolidation.
  const later = composeSeance(know, { now: now + 3 * 3_600_000, seed: 5, start: "29", atlas: "monde" });
  assert.ok(later.plan.length > 0);
});

test("niveau adaptatif (Monde) : s'ajuste vite aux réponses, et les découvertes suivent", () => {
  const easy = WORLD_ITEMS.filter((x) => (difficulty(x.code) ?? 1) < 0.1).map((x) => x.code);
  // Un joueur qui sait tout : quelques réponses justes suffisent à quitter les pays célèbres.
  let fort = updateSkill(undefined, easy.slice(0, 8).map((code) => ({ code, accuracy: 1 })));
  assert.ok(fort.t > 0.5, `après 8 sans-faute : ${fort.t}`);
  // Un débutant qui rate même les pays célèbres : il reste en bas.
  const faible = updateSkill(undefined, easy.slice(0, 8).map((code) => ({ code, accuracy: 0 })));
  assert.ok(faible.t < 0.1, `après 8 ratés : ${faible.t}`);
  // Plus tard, chaque réponse pèse moins (le niveau se stabilise).
  const before = fort.t; fort = updateSkill({ t: before, n: 200 }, [{ code: easy[0], accuracy: 0 }]);
  assert.ok(before - fort.t < 0.06);
  // Les départements n'ont pas de difficulté : ils ne changent rien.
  assert.deepEqual(updateSkill(undefined, [{ code: "48", accuracy: 1 }]), NEW_SKILL);
  // Séance : un joueur fort découvre des pays plus difficiles qu'un débutant.
  const avg = (skill: number) => {
    const s = composeSeance({}, { now: Date.now(), seed: 4, start: "29", atlas: "monde", skill });
    return s.discover.reduce((n, c) => n + difficulty(c)!, 0) / s.discover.length;
  };
  assert.ok(avg(0.9) - avg(0.25) > 0.3, `${avg(0.25)} → ${avg(0.9)}`);
  // Le profil garde le niveau, le fusionne (le plus informé gagne) et le nettoie.
  const p = sanitizeProfile({ ...emptyProfile(), skill: { monde: { t: 0.7, n: 12 }, france: { t: "x" } } });
  assert.deepEqual(p.skill, { monde: { t: 0.7, n: 12 } });
  const m = mergeProfiles({ ...emptyProfile(), skill: { monde: { t: 0.3, n: 3 } } }, p);
  assert.equal(m.skill?.monde?.t, 0.7);
});
