import assert from "node:assert/strict";
import { test } from "node:test";
import { DEPS, PIEGES, de, dep, le } from "./data.ts";
import { ROTATION, plan, seeded, type FormatId } from "./formats.ts";
import { Timeline, estimate, spokenText } from "./timeline.ts";

const RATES = DEPS.filter((d) => !d.outreMer).map((d, i) => ({ code: d.code, rate: 0.9 - i * 0.005, seen: 100 }));
const build = (f: FormatId, seed: string) => {
  const p = plan(f, { rng: seeded(seed), recent: new Set(), rates: RATES });
  assert.ok(p, f);
  const tl = new Timeline(estimate); p.build(tl);
  return { p, tl, said: tl.voice.map((v) => spokenText(v.line.text)) };
};

test("articles à l'oral", () => {
  assert.equal(le(dep("48")), "la Lozère"); assert.equal(le(dep("01")), "l'Ain"); assert.equal(le(dep("71")), "la Saône-et-Loire");
  assert.equal(de(dep("32")), "du Gers"); assert.equal(de(dep("40")), "des Landes"); assert.equal(de(dep("01")), "de l'Ain"); assert.equal(de(dep("75")), "de Paris");
});

test("les pièges de « préfecture ou pas » sont tous de vraies sous-préfectures", () => {
  assert.ok(PIEGES.length >= 30);
  for (const [c, v] of PIEGES) { assert.ok(dep(c).sousPrefectures.includes(v)); assert.notEqual(dep(c).prefecture, v); }
});

test("chaque format se construit, dure entre 12 et 45 s, et rien ne déborde", () => {
  for (const f of ROTATION) for (let i = 0; i < 30; i++) {
    const { tl, said } = build(f, "graine" + i);
    assert.ok(tl.t > 12 && tl.t < 45, `${f} : ${tl.t} s`);
    assert.ok(said.every((s) => s.length < 200), f);
    for (const e of tl.els) assert.ok(e.t1 === undefined || e.t1 >= e.t0, `${f} : ${e.k} ${e.t0}→${e.t1}`);
  }
});

test("vrai ou faux : chaque affirmation est conforme aux données", () => {
  for (let i = 0; i < 60; i++) {
    const { said } = build("vraifaux", "vf" + i);
    const qs = said.slice(0, -1); // tout sauf la fin (plus d'intro : on commence par la première question)
    for (let k = 0; k < qs.length; k += 2) {
      const claim = qs[k], verdict = qs[k + 1].startsWith("Vrai");
      let m: RegExpMatchArray | null;
      if ((m = claim.match(/^(.+) est la préfecture (?:de la |de l'|du |des |de )(.+)\.$/))) {
        const d = DEPS.find((x) => x.nom === m![2])!; assert.ok(d, claim); assert.equal(d.prefecture === m[1], verdict, claim);
      } else if ((m = claim.match(/^(.+) porte(?:nt)? le numéro (\w+)\.$/))) {
        const d = DEPS.find((x) => le(x).toLowerCase() === m![1].toLowerCase())!; assert.ok(d, claim); assert.equal(d.code === m[2], verdict, claim);
      } else if ((m = claim.match(/^(.+) touche(?:nt)? (.+)\.$/))) {
        const a = DEPS.find((x) => le(x).toLowerCase() === m![1].toLowerCase())!, b = DEPS.find((x) => le(x) === m![2])!;
        assert.ok(a && b, claim); assert.equal(a.limitrophes.includes(b.code), verdict, claim);
      } else if ((m = claim.match(/^(.+), c'est (?:en|dans le|dans les) (.+)\.$/))) {
        assert.ok(DEPS.some((x) => le(x).toLowerCase() === m![1].toLowerCase()), claim);
      } else assert.fail("affirmation non reconnue : " + claim);
    }
    const n = (s: string) => said.filter((x) => x.startsWith(s)).length;
    assert.ok(n("Vrai !") >= 1 && n("Faux !") >= 1, "au moins un vrai et un faux");
  }
});

test("préfecture ou pas : la bonne réponse est la préfecture, l'autre une sous-préfecture", () => {
  for (let i = 0; i < 40; i++) {
    const { said } = build("prefecture", "p" + i);
    for (const s of said) {
      const m = s.match(/^La préfecture (?:de la |de l'|du |des |de )(.+), c'est (.+) ou (.+) \?$/); if (!m) continue;
      const d = DEPS.find((x) => x.nom === m[1])!; assert.ok(d, s);
      const [a, b] = [m[2], m[3]]; assert.ok([a, b].includes(d.prefecture), s);
      assert.ok(d.sousPrefectures.includes(a === d.prefecture ? b : a), s);
    }
  }
});

test("les plus ratés : désactivé sans statistiques, et on finit par le plus raté", () => {
  assert.equal(plan("rates", { rng: seeded("x"), recent: new Set() }), null);
  const { said } = build("rates", "r");
  const pcts = said.filter((s) => s.startsWith("Ici !")).map((s) => Number(s.match(/(\d+) %/)![1]));
  assert.deepEqual(pcts, [...pcts].sort((a, b) => a - b));
  assert.equal(pcts.at(-1), 90);
});
