// Les formats de reels. Chacun choisit son contenu dans les données du jeu (tiré au sort avec une graine,
// donc reproductible), puis le met en scène sur une ligne de temps. Tout ce qui est affirmé vient des données.
import { METRO, PIEGES, REGION_FR, TINY, cap1, de, dep, le, regionName, type Dep } from "./data.ts";
import { Timeline, at, rows, type El } from "./timeline.ts";

export type FormatId = "placer" | "numero" | "prefecture" | "vraifaux" | "rates";
/** Ordre de rotation, un format par jour. */
export const ROTATION: FormatId[] = ["placer", "numero", "prefecture", "vraifaux", "rates"];

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

// Les statistiques du premier reel : 65 % des gens partaient dans les 3 premières secondes (4 à 5 s d'intro avant la
// première question). Désormais : la première question dès la première image, l'accroche en bandeau par-dessus,
// 4 questions de 3 secondes, de la plus facile à la plus dure, et une fin courte.
export const NQ = 4;
const COUNT = 3;

/** Bandeau d'accroche, dès la première image ; à fermer (t1) après la première question. */
function opener(tl: Timeline, text: string): El {
  tl.t = 0;
  return tl.add({ k: "banner", t0: 0, text, y: 215 });
}

function outro(tl: Timeline, o: { ask: string; yellow: string[]; tagline: string }) {
  tl.beat();
  const t0 = tl.t;
  tl.add({ k: "veil", t0 });
  tl.add({ k: "hexa", t0, y: 330 });
  const a = tl.say(o.ask, { pad: 1.6 });
  const ra = rows(tl, a, { y: 740, size: 100, max: 13, yellow: o.yellow });
  tl.add({ k: "title", t0: a.t0 + 0.6, text: "hexapop.app", y: Math.max(1400, (ra.at(-1)!.y as number) + 230) });
  tl.add({ k: "label", t0: a.t0 + 0.6, text: o.tagline, y: Math.max(1500, (ra.at(-1)!.y as number) + 330), size: 52, color: "ink" });
}
const OUTRO_SCORE = { ask: `[playful] Ton score sur ${NQ} ? Dis-le en commentaire !`, yellow: ["SCORE", `${NQ}`], tagline: "Le défi du jour t'attend" };

/** Du plus facile au plus dur : un facile pour accrocher (« je sais ! »), des moyens, et le plus raté pour finir. */
function ramp(c: Ctx, pool: Dep[], n: number, easy: string[]): Dep[] {
  const has = new Set(pool.map((d) => d.code));
  const first = fresh(c, pool.filter((d) => easy.includes(d.code)), 1, (d) => d.code);
  const hardCodes = (c.rates ?? []).filter((x) => x.seen >= 20 && has.has(x.code) && !easy.includes(x.code)).slice(0, 15).map((x) => x.code);
  const last = fresh(c, pool.filter((d) => hardCodes.includes(d.code) && !first.includes(d)), 1, (d) => d.code);
  const mid = fresh(c, pool.filter((d) => !first.includes(d) && !last.includes(d) && !easy.includes(d.code)), n - first.length - last.length, (d) => d.code);
  return [...first, ...mid, ...last];
}
/** Départements que presque tout le monde connaît (pour la première question). */
const EASY_MAP = ["13", "33", "29", "59", "06", "67", "64", "2A", "76", "35", "34", "31", "69", "44"];
const EASY_NUM = ["13", "33", "69", "59", "31", "44", "67", "29", "34", "35", "38", "76", "57", "64"];

/** Une question « où est … ? » sur la carte : 3 secondes, puis le département saute en rose. */
function askWhere(tl: Timeline, map: El, d: Dep, header: string, ask: string, reveal: string, under: string) {
  tl.beat();
  const t0 = tl.t, hd = tl.add({ k: "label", t0, text: header, y: 230 });
  const s = tl.say(ask, { pad: 0.1 });
  const caps = rows(tl, s, { y: 340, size: 100, max: 13, yellow: [UP(d.nom)] });
  const c = tl.wait(COUNT); tl.add({ k: "count", t0: c.t0, n: COUNT, y: 1580 });
  const tr = tl.t; tl.dings.push(tr);
  (map.fills as unknown[]).push({ code: d.code, t: tr, color: "pink" }); (map.pops as unknown[]).push({ code: d.code, t: tr });
  const r = tl.say(reveal, { min: 1.6 });
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
  const c = tl.wait(COUNT); tl.add({ k: "count", t0: c.t0, n: COUNT, y: 1200 });
  const tr = tl.t; tl.dings.push(tr); ch.reveal = tr;
  (els[1].pops as unknown[]).push({ code: o.pop, t: tr });
  const r = tl.say(o.reveal, { min: 1.8, pad: 0.4 });
  if (o.note) els.push(tl.add({ k: "label", t0: o.noteAt ? at(r, o.noteAt) : tr + 0.3, text: o.note, y: 1220, size: 50, color: "ink" }));
  tl.beat();
  for (const e of els) e.t1 = tl.t;
}

// ---------- 1. Tu sais placer ces 5 départements ? ----------
function placer(c: Ctx): Plan {
  const ds = ramp(c, METRO.filter((d) => !TINY.has(d.code)), NQ, EASY_MAP);
  return {
    format: "placer", used: ds.map((d) => d.code),
    caption: `Tu sais placer ces ${NQ} départements ? 🗺️\n${ds.map((d) => cap1(le(d))).join(", ")}…\nDis ton score en commentaire 👇\n\nUn défi chaque jour sur hexapop.app\n\n${HASHTAGS}`,
    build(tl) {
      const bn = opener(tl, `${NQ} DÉPARTEMENTS · TU LES PLACES ?`);
      const map = tl.add({ k: "map", t0: 0, box: MAP_ASK, fills: [], pops: [] });
      ds.forEach((d, i) => { askWhere(tl, map, d, i ? `DÉPARTEMENT ${i + 1} / ${NQ}` : "", `[curious] ${verb(d, "Où est", "Où sont")} ${le(d)} ?`, "[excited] Ici !", `${d.code} · Préfecture : ${d.prefecture}`); if (!i) bn.t1 = tl.t; });
      outro(tl, OUTRO_SCORE);
    },
  };
}

// ---------- 2. Le numéro mystère ----------
function numero(c: Ctx): Plan {
  const ds = ramp(c, METRO.filter((d) => !TINY.has(d.code) && /^\d\d$/.test(d.code) && +d.code >= 10), NQ, EASY_NUM);
  return {
    format: "numero", used: ds.map((d) => d.code),
    caption: `Le numéro mystère 🔢 Tu connais ces ${NQ} départements par leur numéro ?\n${ds.map((d) => d.code).join(" · ")}\nDis ton score en commentaire 👇\n\nUn défi chaque jour sur hexapop.app\n\n${HASHTAGS} #numerodepartement`,
    build(tl) {
      const bn = opener(tl, `${NQ} NUMÉROS · TU LES AS TOUS ?`);
      const map = tl.add({ k: "map", t0: 0, box: { x: 60, y: 730, w: 960, h: 740 }, fills: [], pops: [] });
      ds.forEach((d, i) => {
        tl.beat();
        const t0 = tl.t, els: El[] = [];
        els.push(tl.add({ k: "label", t0, text: i ? `NUMÉRO ${i + 1} / ${NQ}` : "", y: 230 }));
        els.push(tl.add({ k: "cap", t0, text: d.code, y: 500, size: 280, font: "bowlby", color: "yellow" }));
        tl.say(`[curious] Le ${d.code}, c'est quoi ?`, { pad: 0.1 });
        const w = tl.wait(COUNT); tl.add({ k: "count", t0: w.t0, n: COUNT, y: 1580 });
        const tr = tl.t; tl.dings.push(tr);
        (map.fills as unknown[]).push({ code: d.code, t: tr, color: "pink" }); (map.pops as unknown[]).push({ code: d.code, t: tr });
        const r = tl.say(`[excited] ${cap1(le(d))} !`, { min: 1.6 });
        const rr = rows(tl, r, { y: 1560, size: 96, max: 16, yellow: [UP(d.nom)] }); els.push(...rr);
        els.push(tl.add({ k: "label", t0: tr + 0.4, text: `Préfecture : ${d.prefecture}`, y: Math.min(1860, (rr.at(-1)?.y as number ?? 1560) + 130), size: 56, color: "ink" }));
        tl.beat();
        for (const e of els) e.t1 = tl.t;
        (map.fills as unknown[]).push({ code: d.code, t: tl.t, color: "soft" });
        if (!i) bn.t1 = tl.t;
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
    caption: `Préfecture ou pas ? 🏛️ 4 pièges, 3 secondes chacun.\nTu tombes dans combien ? Dis-le en commentaire 👇\n\nUn défi chaque jour sur hexapop.app\n\n${HASHTAGS} #prefecture`,
    build(tl) {
      const bn = opener(tl, "PRÉFECTURE OU PAS ? 4 PIÈGES");
      qs.forEach((q, i) => { askChoice(tl, {
        header: i ? `PIÈGE ${i + 1} / 4` : "",
        ask: `[curious] La préfecture ${de(q.d)}, c'est ${items[i][0]} ou ${items[i][1]} ?`,
        items: items[i], answer: items[i].indexOf(q.d.prefecture), showAt: "c'est", capTo: "c'est",
        reveal: `[excited] C'est ${q.d.prefecture} !`,
        note: `${q.trap} : sous-préfecture`, codes: [q.d.code], pop: q.d.code,
      }); if (!i) bn.t1 = tl.t; });
      outro(tl, { ...OUTRO_SCORE, ask: "[playful] T'es tombé dans combien de pièges ? Dis-le en commentaire !", yellow: ["PIÈGES"] });
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
      const bn = opener(tl, "VRAI OU FAUX ? TU FAIS 4 / 4 ?");
      qs.forEach((q, i) => { askChoice(tl, {
        header: i ? `AFFIRMATION ${i + 1} / 4` : "", ask: `[curious] ${q.text}`, items: ["VRAI", "FAUX"], answer: q.ok ? 0 : 1, showAt: "",
        reveal: q.ok ? "[excited] Vrai !" : `[excited] Faux ! ${q.fix}`, note: q.note, codes: q.codes, pop: q.pop,
      }); if (!i) bn.t1 = tl.t; });
      outro(tl, OUTRO_SCORE);
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
      const bn = opener(tl, firstTime ? "LES 3 PLUS RATÉS SUR HEXA" : "SOUVENT RATÉS SUR HEXA");
      const map = tl.add({ k: "map", t0: 0, box: MAP_ASK, fills: [], pops: [] });
      order.forEach((x, i) => {
        const d = dep(x.code), pct = Math.round(x.rate * 100);
        askWhere(tl, map, d, !i ? "" : firstTime ? `N°${3 - i} DES PLUS RATÉS` : `RATÉ ${i + 1} / 3`, `[curious] ${verb(d, "Où est", "Où sont")} ${le(d)} ?`, `[excited] Ici ! ${pct} % d'erreurs sur Hexa.`, `${d.code} · Préfecture : ${d.prefecture}`);
        if (!i) bn.t1 = tl.t;
      });
      outro(tl, { ...OUTRO_SCORE, ask: "[playful] Ton score sur 3 ? Dis-le en commentaire !", yellow: ["SCORE", "3"] });
    },
  };
}

export function plan(format: FormatId, c: Ctx): Plan | null {
  return { placer, numero, prefecture, vraifaux, rates }[format](c);
}
