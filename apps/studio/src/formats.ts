// Les formats de reels. Chacun choisit son contenu dans les données du jeu (tiré au sort avec une graine,
// donc reproductible), puis le met en scène sur une ligne de temps. Tout ce qui est affirmé vient des données.
import { DEPS, METRO, PIEGES, REGION_FR, TINY, cap1, de, dep, le, regionName, type Dep } from "./data.ts";
import { Timeline, at, rows, type El, type Said } from "./timeline.ts";

export type FormatId = "placer" | "numero" | "prefecture" | "vraifaux" | "region" | "rates";
/** Ordre de rotation, un format par jour. */
export const ROTATION: FormatId[] = ["placer", "numero", "prefecture", "vraifaux", "region", "rates"];

export interface Ctx {
  rng: () => number;
  /** Codes déjà utilisés récemment par ce format (on les évite tant qu'il reste du choix). */
  recent: Set<string>;
  /** Taux d'erreur par département (format « rates »), du plus raté au moins raté. */
  rates?: { code: string; rate: number; seen: number }[];
}
export interface Plan {
  format: FormatId;
  /** Ce que le reel utilise (mémorisé pour ne pas resservir les mêmes). */
  used: string[];
  /** La légende du post (Instagram, TikTok). */
  caption: string;
  build(tl: Timeline): void;
}

// ---------- tirage ----------
export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
function shuffle<T>(r: () => number, xs: readonly T[]): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** n éléments au hasard, en évitant d'abord ceux utilisés récemment. */
function fresh<T>(c: Ctx, xs: readonly T[], n: number, key: (x: T) => string): T[] {
  const s = shuffle(c.rng, xs), a = s.filter((x) => !c.recent.has(key(x))), b = s.filter((x) => c.recent.has(key(x)));
  return [...a, ...b].slice(0, n);
}
const UP = (s: string) => s.toLocaleUpperCase("fr-FR");
const plural = (d: Dep) => (d.article === "les" ? true : false);
const verb = (d: Dep, sg: string, pl: string) => (plural(d) ? pl : sg);

// ---------- mise en page commune ----------
const HASHTAGS = "#geographie #departements #france #quiz #culturegenerale #cartedefrance";
const MAP_ASK = { x: 60, y: 600, w: 960, h: 860 };
const MAP_SMALL = { x: 190, y: 1330, w: 700, h: 520 };

function hook(tl: Timeline, lines: string[], yellow: string[]) {
  tl.beat();
  const t0 = tl.t, hx = tl.add({ k: "hexa", t0, bob: true, y: 400 });
  let last: Said | undefined;
  for (const text of lines) { last = tl.say(text, { pad: 0.15 }); rows(tl, last, { y: 900, size: 100, max: 16, yellow, t1: last.t1 }); }
  tl.wait(0.25);
  hx.t1 = tl.t; hx.wowAt = last!.t0;
}

function outro(tl: Timeline, o: { ask: string; yellow: string[]; cta: string; tagline: string }) {
  tl.beat();
  const t0 = tl.t;
  tl.add({ k: "veil", t0 });
  tl.add({ k: "hexa", t0, y: 330 });
  const a = tl.say(o.ask, { pad: 0.15 });
  const ra = rows(tl, a, { y: 740, size: 112, max: 14, yellow: o.yellow });
  const b = tl.say("[enthusiastic] Dis-le en commentaire !", { pad: 0.15 });
  rows(tl, b, { y: (ra.at(-1)!.y as number) + 150, size: 72, max: 24 });
  const c = tl.say(o.cta, { pad: 1.4 });
  tl.add({ k: "title", t0: at(c, "hexapop"), text: "hexapop.app", y: 1480 });
  tl.add({ k: "label", t0: c.t0, text: o.tagline, y: 1580, size: 52, color: "ink" });
}
const OUTRO_SCORE = { ask: "[playful] Alors, t'en as eu combien ?", yellow: ["COMBIEN"], cta: "Et le défi du jour t'attend sur hexapop point app.", tagline: "Le défi du jour t'attend" };

/** Une question « où est … ? » sur la carte : 5 secondes, puis le département saute en rose. */
function askWhere(tl: Timeline, map: El, d: Dep, header: string, ask: string, reveal: string, under: string) {
  tl.beat();
  const t0 = tl.t, hd = tl.add({ k: "label", t0, text: header, y: 230 });
  const s = tl.say(ask, { pad: 0.1 });
  const caps = rows(tl, s, { y: 340, size: 100, max: 13, yellow: [UP(d.nom)] });
  const c = tl.wait(5); tl.add({ k: "count", t0: c.t0, n: 5, y: 1580 });
  const tr = tl.t; tl.dings.push(tr);
  (map.fills as unknown[]).push({ code: d.code, t: tr, color: "pink" }); (map.pops as unknown[]).push({ code: d.code, t: tr });
  const r = tl.say(reveal, { min: 2 });
  const caps2 = rows(tl, r, { y: 1560, size: 96, max: 16, yellow: ["ICI"] });
  const u = tl.add({ k: "label", t0: tr + 0.4, text: under, y: Math.min(1860, (caps2.at(-1)?.y as number ?? 1560) + 130), size: 56, color: "ink" });
  tl.beat();
  for (const e of [hd, ...caps, ...caps2, u]) e.t1 = tl.t;
  (map.fills as unknown[]).push({ code: d.code, t: tl.t, color: "soft" });
}

/** Une question à deux réponses (préfecture ou pas, vrai ou faux). */
function askChoice(tl: Timeline, o: { header: string; ask: string; items: string[]; answer: number; showAt: string; reveal: string; note?: string; noteAt?: string; codes: string[]; pop: string; capTo?: string }) {
  tl.beat();
  const t0 = tl.t, els: El[] = [];
  els.push(tl.add({ k: "label", t0, text: o.header, y: 230 }));
  els.push(tl.add({ k: "map", t0, box: MAP_SMALL, fills: o.codes.map((code) => ({ code, t: t0, color: "pink" })), pops: [] }));
  const s = tl.say(o.ask, { pad: 0.1 });
  const to = o.capTo ? s.words.findIndex((w) => w.w.toLowerCase() === o.capTo) : -1; // la question sans les réponses (déjà sur les cartes)
  els.push(...rows(tl, s, { y: 330, size: 84, max: 18, ...(to > 0 ? { to, end: " ?" } : {}) }));
  const ch = tl.add({ k: "choice", t0: at(s, o.showAt), y: 690, items: o.items, answer: o.answer, reveal: 1e9 });
  els.push(ch);
  const c = tl.wait(5); tl.add({ k: "count", t0: c.t0, n: 5, y: 1200 });
  const tr = tl.t; tl.dings.push(tr); ch.reveal = tr;
  (els[1].pops as unknown[]).push({ code: o.pop, t: tr });
  const r = tl.say(o.reveal, { min: 2.2, pad: 0.6 });
  if (o.note) els.push(tl.add({ k: "label", t0: o.noteAt ? at(r, o.noteAt) : tr + 0.3, text: o.note, y: 1220, size: 50, color: "ink" }));
  tl.beat();
  for (const e of els) e.t1 = tl.t;
}

// ---------- 1. Tu sais placer ces 5 départements ? ----------
function placer(c: Ctx): Plan {
  const ds = fresh(c, METRO.filter((d) => !TINY.has(d.code)), 5, (d) => d.code);
  return {
    format: "placer", used: ds.map((d) => d.code),
    caption: `Tu sais placer ces 5 départements ? 🗺️\n${ds.map((d) => cap1(le(d))).join(", ")}…\nDis ton score en commentaire 👇\n\nUn défi chaque jour sur hexapop.app\n\n${HASHTAGS}`,
    build(tl) {
      hook(tl, ["[enthusiastic] Tu sais placer ces 5 départements ?", "[excited] 5 secondes chacun. C'est parti !"], ["DÉPARTEMENTS", "PARTI"]);
      const map = tl.add({ k: "map", t0: tl.beat(), box: MAP_ASK, fills: [], pops: [] });
      ds.forEach((d, i) => askWhere(tl, map, d, `DÉPARTEMENT ${i + 1} / 5`, `[curious] ${verb(d, "Où est", "Où sont")} ${le(d)} ?`, "[excited] Ici !", `${d.code} · Préfecture : ${d.prefecture}`));
      outro(tl, OUTRO_SCORE);
    },
  };
}

// ---------- 2. Le numéro mystère ----------
function numero(c: Ctx): Plan {
  const ds = fresh(c, METRO.filter((d) => !TINY.has(d.code) && /^\d\d$/.test(d.code) && +d.code >= 10), 5, (d) => d.code);
  return {
    format: "numero", used: ds.map((d) => d.code),
    caption: `Le numéro mystère 🔢 Tu connais ces 5 départements par leur numéro ?\n${ds.map((d) => d.code).join(" · ")}\nDis ton score en commentaire 👇\n\nUn défi chaque jour sur hexapop.app\n\n${HASHTAGS} #numerodepartement`,
    build(tl) {
      hook(tl, ["[enthusiastic] Le numéro mystère !", "[excited] Je te donne un numéro, tu trouves le département. 5 secondes !"], ["MYSTÈRE", "NUMÉRO"]);
      const map = tl.add({ k: "map", t0: tl.beat(), box: { x: 60, y: 730, w: 960, h: 740 }, fills: [], pops: [] });
      ds.forEach((d, i) => {
        tl.beat();
        const t0 = tl.t, els: El[] = [];
        els.push(tl.add({ k: "label", t0, text: `NUMÉRO ${i + 1} / 5`, y: 230 }));
        els.push(tl.add({ k: "cap", t0, text: d.code, y: 500, size: 280, font: "bowlby", color: "yellow" }));
        tl.say(`[curious] Le ${d.code} ?`, { pad: 0.1 });
        const w = tl.wait(5); tl.add({ k: "count", t0: w.t0, n: 5, y: 1580 });
        const tr = tl.t; tl.dings.push(tr);
        (map.fills as unknown[]).push({ code: d.code, t: tr, color: "pink" }); (map.pops as unknown[]).push({ code: d.code, t: tr });
        const r = tl.say(`[excited] ${cap1(le(d))} !`, { min: 2 });
        const rr = rows(tl, r, { y: 1560, size: 96, max: 16, yellow: [UP(d.nom)] }); els.push(...rr);
        els.push(tl.add({ k: "label", t0: tr + 0.4, text: `Préfecture : ${d.prefecture}`, y: Math.min(1860, (rr.at(-1)?.y as number ?? 1560) + 130), size: 56, color: "ink" }));
        tl.beat();
        for (const e of els) e.t1 = tl.t;
        (map.fills as unknown[]).push({ code: d.code, t: tl.t, color: "soft" });
      });
      outro(tl, OUTRO_SCORE);
    },
  };
}

// ---------- 3. Préfecture ou pas ? ----------
function prefecture(c: Ctx): Plan {
  const pieges = fresh(c, PIEGES, 4, ([code]) => code);
  const seen = new Set<string>(); const qs: { d: Dep; trap: string }[] = [];
  for (const [code, trap] of pieges) if (!seen.has(code)) { seen.add(code); qs.push({ d: dep(code), trap }); }
  for (const d of fresh(c, METRO.filter((d) => d.sousPrefectures.length && !seen.has(d.code)), 5, (d) => d.code)) {
    if (qs.length >= 4) break; qs.push({ d, trap: pick(c.rng, d.sousPrefectures) });
  }
  const items = qs.map((q) => (c.rng() < 0.5 ? [q.trap, q.d.prefecture] : [q.d.prefecture, q.trap]));
  return {
    format: "prefecture", used: qs.map((q) => q.d.code),
    caption: `Préfecture ou pas ? 🏛️ 4 pièges, 5 secondes chacun.\nTu tombes dans combien ? Dis-le en commentaire 👇\n\nUn défi chaque jour sur hexapop.app\n\n${HASHTAGS} #prefecture`,
    build(tl) {
      hook(tl, ["[enthusiastic] Préfecture ou pas ?", "[excited] 4 pièges, 5 secondes chacun !"], ["PRÉFECTURE", "PIÈGES"]);
      qs.forEach((q, i) => askChoice(tl, {
        header: `PIÈGE ${i + 1} / 4`,
        ask: `[curious] La préfecture ${de(q.d)}, c'est ${items[i][0]} ou ${items[i][1]} ?`,
        items: items[i], answer: items[i].indexOf(q.d.prefecture), showAt: "c'est", capTo: "c'est",
        reveal: `[excited] C'est ${q.d.prefecture} !`,
        note: `${q.trap} : sous-préfecture`, codes: [q.d.code], pop: q.d.code,
      }));
      outro(tl, { ...OUTRO_SCORE, ask: "[playful] Alors, t'es tombé dans combien de pièges ?", yellow: ["PIÈGES"] });
    },
  };
}

// ---------- 8. Vrai ou faux ? ----------
interface Claim { text: string; ok: boolean; fix?: string; note?: string; codes: string[]; pop: string; key: string }
function claims(c: Ctx, d: Dep): Claim[] {
  const out: Claim[] = [], r = c.rng, D = cap1(le(d));
  { // préfecture
    const traps = PIEGES.filter(([k]) => k === d.code).map(([, v]) => v), wrong = traps.length ? pick(r, traps) : d.sousPrefectures.length ? pick(r, d.sousPrefectures) : null;
    if (wrong) { const ok = r() < 0.5, v = ok ? d.prefecture : wrong; out.push({ text: `${v} est la préfecture ${de(d)}.`, ok, fix: `C'est ${d.prefecture}.`, note: `Préfecture : ${d.prefecture}`, codes: [d.code], pop: d.code, key: "pref" }); }
  }
  if (/^\d\d$/.test(d.code) && +d.code >= 10) { // numéro
    const near = METRO.filter((x) => x.code !== d.code && /^\d\d$/.test(x.code) && +x.code >= 10 && Math.abs(+x.code - +d.code) <= 4);
    const ok = r() < 0.5, n = ok ? d.code : pick(r, near).code;
    out.push({ text: `${D} ${verb(d, "porte", "portent")} le numéro ${n}.`, ok, fix: `C'est le ${d.code}.`, note: `${d.nom} : ${d.code}`, codes: [d.code], pop: d.code, key: "num" });
  }
  { // région
    const others = [...new Set(d.limitrophes.map((x) => dep(x).region).filter((x) => x !== d.region && REGION_FR[x]))];
    if (others.length && REGION_FR[d.region]) {
      const ok = r() < 0.5, reg = ok ? d.region : pick(r, others);
      out.push({ text: `${D}, c'est ${REGION_FR[reg].en}.`, ok, fix: `C'est ${REGION_FR[d.region].en}.`, note: `Région : ${regionName(d.region)}`, codes: [d.code], pop: d.code, key: "reg" });
    }
  }
  { // voisins
    const near = new Set(d.limitrophes), two = [...new Set(d.limitrophes.flatMap((x) => dep(x).limitrophes))].filter((x) => x !== d.code && !near.has(x) && !dep(x).outreMer);
    if (d.limitrophes.length && two.length) {
      const ok = r() < 0.5, o = dep(ok ? pick(r, d.limitrophes) : pick(r, two));
      out.push({ text: `${D} ${verb(d, "touche", "touchent")} ${le(o)}.`, ok, fix: "Pas de frontière commune.", note: ok ? "Voisins !" : "Pas de frontière commune", codes: [d.code, o.code], pop: o.code, key: "voisin" });
    }
  }
  return out;
}
function vraifaux(c: Ctx): Plan {
  const ds = fresh(c, METRO.filter((d) => !TINY.has(d.code)), 12, (d) => d.code);
  const qs: Claim[] = [], kinds: string[] = [];
  for (const d of ds) {
    if (qs.length >= 4) break;
    const cs = claims(c, d).filter((x) => kinds.filter((k) => k === x.key).length < 2);
    if (cs.length) { const x = pick(c.rng, cs); qs.push(x); kinds.push(x.key); }
  }
  // Ni tout vrai ni tout faux.
  const nOk = qs.filter((q) => q.ok).length;
  if (nOk < 1 || nOk > 3) return vraifaux({ ...c, rng: seeded(String(c.rng())) });
  return {
    format: "vraifaux", used: qs.map((q) => q.codes[0]),
    caption: `Vrai ou faux ? 🤔 4 affirmations sur les départements.\nT'en as eu combien ? Dis-le en commentaire 👇\n\nUn défi chaque jour sur hexapop.app\n\n${HASHTAGS} #vraioufaux`,
    build(tl) {
      hook(tl, ["[enthusiastic] Vrai ou faux ?", "[excited] 4 affirmations, 5 secondes pour chacune !"], ["VRAI", "FAUX"]);
      qs.forEach((q, i) => askChoice(tl, {
        header: `AFFIRMATION ${i + 1} / 4`, ask: `[curious] ${q.text}`, items: ["VRAI", "FAUX"], answer: q.ok ? 0 : 1, showAt: "",
        reveal: q.ok ? "[excited] Vrai !" : `[excited] Faux ! ${q.fix}`, note: q.note, codes: q.codes, pop: q.pop,
      }));
      outro(tl, OUTRO_SCORE);
    },
  };
}

// ---------- 4. Une région en 30 secondes ----------
function region(c: Ctx): Plan {
  const regs = Object.keys(REGION_FR).filter((r) => r !== "94");
  const reg = fresh(c, regs, 1, (r) => r)[0];
  const ds = DEPS.filter((d) => d.region === reg).sort((a, b) => a.code.localeCompare(b.code));
  const R = REGION_FR[reg], name = regionName(reg);
  return {
    format: "region", used: [reg],
    caption: `Les ${ds.length} départements ${R.de} 🗺️ Tu les connaissais tous ?\n${ds.map((d) => `${d.code} ${d.nom}`).join(" · ")}\n\nApprends-les en jouant sur hexapop.app\n\n${HASHTAGS} #${name.normalize("NFD").replace(/[^A-Za-z]/g, "").toLowerCase()}`,
    build(tl) {
      hook(tl, [`[enthusiastic] Les ${ds.length} départements ${R.de}, tu les connais ?`, "[excited] On les fait tous, top chrono !"], [UP(name).split(/[\s-]/)[0], "CHRONO"]);
      tl.beat();
      const t0 = tl.t, map = tl.add({ k: "map", t0, box: { x: 40, y: 300, w: 1000, h: 1120 }, focus: ds.map((d) => d.code), fills: [], pops: [], tags: [] });
      const hd = tl.add({ k: "label", t0, text: UP(name), y: 230 });
      const s = tl.say(`[enthusiastic] ${cap1(ds.map((d) => le(d)).join(", "))}.`, { pad: 1.2 });
      // le premier mot de chaque département dans ce qui a été lu
      let w = 0; const starts = ds.map((d) => { const t = s.words[w]?.t ?? s.t0; w += le(d).split(" ").length; return t; });
      const ok = w === s.words.length;
      ds.forEach((d, i) => {
        const t = ok ? starts[i] : s.t0 + (i * (s.t1 - s.t0 - 1.2)) / ds.length, next = i + 1 < ds.length ? (ok ? starts[i + 1] : s.t0 + ((i + 1) * (s.t1 - s.t0 - 1.2)) / ds.length) : s.t1;
        (map.fills as unknown[]).push({ code: d.code, t, color: "pink" }, { code: d.code, t: next, color: "soft" });
        (map.pops as unknown[]).push({ code: d.code, t });
        (map.tags as unknown[]).push({ code: d.code, t, text: d.code });
        tl.add({ k: "cap", t0: t, t1: next, text: UP(d.nom), y: 1580, size: 100, color: "yellow" });
      });
      tl.beat(); map.t1 = tl.t; hd.t1 = tl.t;
      tl.add({ k: "map", t0: tl.t, box: { x: 40, y: 300, w: 1000, h: 1120 }, focus: ds.map((d) => d.code), fills: ds.map((d) => ({ code: d.code, t: 0, color: "pink" })), tags: ds.map((d) => ({ code: d.code, t: 0, text: d.code })) });
      outro(tl, { ask: "[playful] Tu les connaissais tous ?", yellow: ["TOUS"], cta: "Apprends-les en jouant sur hexapop point app.", tagline: "Apprends-les en jouant" });
    },
  };
}

// ---------- 6. Les départements les plus ratés sur Hexa ----------
function rates(c: Ctx): Plan | null {
  const top = (c.rates ?? []).filter((x) => !TINY.has(x.code) && !dep(x.code).outreMer && x.seen >= 50).slice(0, 15);
  if (top.length < 6) return null;
  const top3 = top.slice(0, 3), firstTime = !top3.some((x) => c.recent.has(x.code));
  const qs = firstTime ? top3 : fresh(c, top, 3, (x) => x.code).sort((a, b) => b.rate - a.rate);
  const order = [...qs].reverse(); // on finit par le plus raté
  const most = firstTime ? "le plus" : "souvent";
  return {
    format: "rates", used: qs.map((x) => x.code),
    caption: `Les départements que les joueurs d'Hexa ratent ${most} 😬 Tu sais où ils sont ?\nDis-le en commentaire 👇\n\nUn défi chaque jour sur hexapop.app\n\n${HASHTAGS}`,
    build(tl) {
      hook(tl, [`[enthusiastic] 3 départements que les joueurs d'Hexa ratent ${most}.`, "[curious] Tu sais où ils sont ?"], ["RATENT", "OÙ"]);
      const map = tl.add({ k: "map", t0: tl.beat(), box: MAP_ASK, fills: [], pops: [] });
      order.forEach((x, i) => {
        const d = dep(x.code), pct = Math.round(x.rate * 100);
        askWhere(tl, map, d, firstTime ? `N°${3 - i} DES PLUS RATÉS` : `RATÉ ${i + 1} / 3`, `[curious] ${verb(d, "Où est", "Où sont")} ${le(d)} ?`, `[excited] Ici ! ${pct} % d'erreurs sur Hexa.`, `${d.code} · Préfecture : ${d.prefecture}`);
      });
      outro(tl, OUTRO_SCORE);
    },
  };
}

export function plan(format: FormatId, c: Ctx): Plan | null {
  return { placer, numero, prefecture, vraifaux, region, rates }[format](c);
}
