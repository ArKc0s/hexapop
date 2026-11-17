// Pages de référencement, générées à chaque compilation (après `vite build`) dans apps/web/dist.
// HTML pur, léger et lisible par tous les moteurs : une page par chose qu'on cherche (« préfecture du Finistère »,
// « liste des départements », « carte des départements », « quiz départements »), avec la réponse en haut de page,
// des cartes cliquables, des fiches question / réponse balisées (schema.org) et un maillage serré vers le jeu.
//
// Pensé pour la feuille de route des atlas : chaque atlas est un module (pages + quiz + plan du site) sous son
// préfixe (/france, plus tard /europe…), les quiz sont regroupés sous /quiz, et le plan du site est un index
// de plans par atlas. Ajouter un atlas = ajouter un module, sans toucher aux adresses existantes.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { DEPARTEMENTS, REGIONS, DEP, REGION, OUTRE_MER, TOUR, withArticle, type Departement, type Region } from "@hexa/game";
import map from "../../../packages/data/src/map.json" with { type: "json" };

const SITE = "https://hexapop.app";
const DIST = new URL("../dist/", import.meta.url);
const TODAY = new Date().toISOString().slice(0, 10);

// ---------- outils ----------
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/œ/g, "oe").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} et ${xs[xs.length - 1]}`);
function write(path: string, html: string) {
  const dir = new URL("." + (path.endsWith("/") ? path : path + "/"), DIST);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL("index.html", dir), html);
}

// Grammaire des noms de départements : « le Finistère », « la Somme », « l'Ain », « les Landes », « Paris ».
const sujet = (d: Departement) => cap(withArticle(d));
const est = (d: Departement) => (d.article === "les" ? "sont" : "est");
const de = (d: Departement) => (d.article === "le" ? `du ${d.nom}` : d.article === "les" ? `des ${d.nom}` : d.article === "la" ? `de la ${d.nom}` : d.article === "l'" ? `de l'${d.nom}` : `de ${d.nom}`);
// Régions : « en Bretagne », « dans le Grand Est », « à La Réunion »…
const EN: Record<string, string> = { "04": "à La Réunion", "06": "à Mayotte", "32": "dans les Hauts-de-France", "44": "dans le Grand Est", "52": "dans les Pays de la Loire" };
const enRegion = (r: Region) => EN[r.code] ?? `en ${r.nom}`;
const DE_R: Record<string, string> = { "04": "de La Réunion", "32": "des Hauts-de-France", "44": "du Grand Est", "52": "des Pays de la Loire", "11": "d'Île-de-France", "75": "de Nouvelle-Aquitaine", "76": "d'Occitanie", "84": "d'Auvergne-Rhône-Alpes" };
const deRegion = (r: Region) => DE_R[r.code] ?? `de ${r.nom}`;

// ---------- cartes (SVG en ligne, à partir des contours IGN du jeu) ----------
type Pt = [number, number];
const pathPts = (d: string): Pt[] => { const n = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number); const out: Pt[] = []; for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]); return out; };
function bbox(codes: string[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of codes) for (const [x, y] of pathPts((map.paths as Record<string, string>)[c])) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const REGION_TINT = ["#fde9f3", "#e3eefa", "#fff4c2", "#e5f4ec", "#f1e7fb", "#fdeedd", "#e8f1f2", "#f6f0e2"];
const tintOf = (region: string) => REGION_TINT[REGIONS.findIndex((r) => r.code === region) % REGION_TINT.length];
const LABELS = map.labels as Record<string, [number, number]>;

/** Carte de quelques départements (une région), celui de la page mis en avant, chaque département cliquable. */
function svgMap(codes: string[], opts: { highlight?: string; outline?: string[]; labels?: boolean; title: string; tint?: boolean }) {
  const b = bbox(codes);
  const pad = Math.max(b.w, b.h) * 0.05;
  const k = Math.max(b.w, b.h);
  const fs = k * (codes.length > 20 ? 0.012 : 0.045);
  const paths = map.paths as Record<string, string>;
  const shapes = codes.map((c) => {
    const d = DEP.get(c)!;
    const fill = c === opts.highlight ? "#ffd93d" : opts.tint ? tintOf(d.region) : "#fffdf8";
    return `<a href="${depUrl(d)}" aria-label="${esc(d.nom)} (${c})"><path d="${paths[c]}" fill="${fill}"/></a>`;
  }).join("");
  const outline = (opts.outline ?? []).map((r) => (map.regions as Record<string, string>)[r]).filter(Boolean).map((p) => `<path d="${p}"/>`).join("");
  const labels = opts.labels ? codes.filter((c) => LABELS[c] && !["75", "92", "93", "94"].includes(c) || (codes.length < 20 && LABELS[c])).map((c) => `<text x="${LABELS[c][0]}" y="${LABELS[c][1]}">${c}</text>`).join("") : "";
  return `<svg class="map" viewBox="${(b.x - pad).toFixed(1)} ${(b.y - pad).toFixed(1)} ${(b.w + 2 * pad).toFixed(1)} ${(b.h + 2 * pad).toFixed(1)}" role="img" aria-label="${esc(opts.title)}">
<g class="shadow" transform="translate(${(k * 0.008).toFixed(2)} ${(k * 0.008).toFixed(2)})">${codes.map((c) => `<path d="${paths[c]}"/>`).join("")}</g>
<g class="deps">${shapes}</g><g class="outline">${outline}</g>
<g class="labels" font-size="${fs.toFixed(1)}">${labels}</g></svg>`;
}

// ---------- images d'aperçu (1200 × 630), dessinées en SVG puis converties en PNG à la compilation ----------
interface OgCard { kicker: string; title: string; facts: string[]; highlight: string[]; /** Zone cadrée (outre-mer) ; sinon la métropole. */ zone?: string[]; /** Départements teintés autour (la région). */ tint?: string[] }
const ogPath = (path: string) => `/og${path}.png`;
const OG_FONTS = ["gabarito-800.ttf", "gabarito-600.ttf", "bowlby-one.ttf"].map((f) => new URL(`./og-fonts/${f}`, import.meta.url).pathname);
const METRO = DEPARTEMENTS.filter((d) => !d.outreMer).map((d) => d.code);
const METRO_BOX = bbox(METRO);
/** Coupe un nom long sur deux lignes (aux espaces ou aux traits d'union). */
function ogLines(t: string, max: number): string[] {
  if (t.length <= max) return [t];
  const cuts = [...t.matchAll(/[ -]/g)].map((m) => m.index!);
  const at = cuts.reduce((best, i) => (Math.abs(i - t.length / 2) < Math.abs(best - t.length / 2) ? i : best), cuts[0] ?? -1);
  if (at < 0) return [t];
  return [t.slice(0, at + (t[at] === "-" ? 1 : 0)), t.slice(at + 1)];
}
function ogSvg(o: OgCard): string {
  const paths = map.paths as Record<string, string>;
  const codes = o.zone ?? METRO;
  const b = o.zone ? bbox(o.zone) : METRO_BOX;
  const pad = Math.max(b.w, b.h) * 0.04, k = Math.max(b.w, b.h);
  const hi = new Set(o.highlight), tint = new Set(o.tint ?? []);
  const shapes = codes.map((c) => `<path d="${paths[c]}" fill="${hi.has(c) ? "#ff4fae" : tint.has(c) ? "#ffd0e8" : "#fffdf8"}"/>`).join("");
  const title = o.title.toUpperCase();
  const lines = ogLines(title, 13);
  const longest = Math.max(...lines.map((l) => l.length));
  const fs = longest <= 9 ? 84 : longest <= 12 ? 70 : longest <= 15 ? 58 : 48;
  const tY = 300;
  const titleSvg = lines.map((l, i) => `<text x="70" y="${tY + i * fs * 1.02}" font-family="Gabarito" font-weight="800" font-size="${fs}" fill="#1c1a37">${esc(l)}</text>`).join("");
  const fy = tY + (lines.length - 1) * fs * 1.02 + 62;
  const facts = o.facts.map((f, i) => `<text x="70" y="${fy + i * 42}" font-family="Gabarito" font-weight="600" font-size="32" fill="#1c1a37">${esc(f)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f3eee4"/>
<text x="76" y="128" font-family="Bowlby One" font-size="64" fill="#ff4fae">HEXA</text>
<text x="70" y="122" font-family="Bowlby One" font-size="64" fill="#1572c4">HEXA</text>
<text x="70" y="${tY - fs - 6}" font-family="Gabarito" font-weight="600" font-size="30" fill="#6b6884">${esc(o.kicker)}</text>
${titleSvg}${facts}
<rect x="70" y="512" width="420" height="64" rx="32" fill="#d9a90b"/><rect x="70" y="506" width="420" height="64" rx="32" fill="#ffd93d"/>
<text x="280" y="548" text-anchor="middle" font-family="Gabarito" font-weight="800" font-size="27" fill="#1c1a37">Quiz gratuit · hexapop.app</text>
<svg x="610" y="30" width="560" height="570" viewBox="${(b.x - pad).toFixed(1)} ${(b.y - pad).toFixed(1)} ${(b.w + 2 * pad).toFixed(1)} ${(b.h + 2 * pad).toFixed(1)}">
<g transform="translate(${(k * 0.008).toFixed(2)} ${(k * 0.008).toFixed(2)})" fill="#ff4fae">${codes.map((c) => `<path d="${paths[c]}"/>`).join("")}</g>
<g stroke="#9a907c" stroke-width="${(k * 0.0012).toFixed(2)}" stroke-linejoin="round">${shapes}</g>
</svg></svg>`;
}
function renderOg(path: string, o: OgCard) {
  const png = new Resvg(ogSvg(o), { font: { fontFiles: OG_FONTS, loadSystemFonts: false, defaultFontFamily: "Gabarito" } }).render().asPng();
  const file = new URL("." + ogPath(path), DIST);
  mkdirSync(new URL(".", file), { recursive: true });
  writeFileSync(file, png);
}

// ---------- adresses (l'atlas France vit sous /france) ----------
export const depUrl = (d: Departement) => `/france/departements/${d.code.toLowerCase()}-${slug(d.nom)}`;
export const regionUrl = (r: Region) => `/france/regions/${slug(r.nom)}`;
const tourCode = (d: Departement) => (d.outreMer ? OUTRE_MER : d.region);

// ---------- gabarit ----------
interface Crumb { name: string; url: string }
interface Page {
  path: string; title: string; description: string; h1: string; lead: string; body: string;
  crumbs: Crumb[]; jsonld?: object[]; type?: "website" | "article"; atlas?: string;
  /** Image d'aperçu propre à la page (partage Discord, WhatsApp…) : sinon l'image générale du jeu. */
  og?: OgCard;
}
const pages: Page[] = [];

function layout(p: Page): string {
  const url = SITE + p.path;
  const crumbs = [{ name: "Hexa", url: "/" }, ...p.crumbs];
  const ld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: SITE + c.url })) },
    ...(p.jsonld ?? []),
  ];
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#f3eee4">
<link rel="icon" href="/favicon.ico" sizes="32x32 48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/seo/fonts/gabarito-800.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/seo/seo.css">
<meta property="og:type" content="${p.type ?? "article"}">
<meta property="og:site_name" content="Hexa">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:image" content="${SITE}${p.og ? ogPath(p.path) : "/og.png"}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld).replace(/</g, "\\u003c")}</script>
</head>
<body>
<header class="top">
  <a class="logo" href="/" aria-label="Hexa, l'accueil du jeu">HEXA</a>
  <nav aria-label="Rubriques">
    <a href="/france/departements">Départements</a>
    <a href="/france/carte-des-departements">Carte</a>
    <a href="/france/prefectures">Préfectures</a>
    <a href="/france/regions">Régions</a>
    <a href="/quiz">Quiz</a>
  </nav>
  <a class="play" href="/">Jouer</a>
</header>
<nav class="crumbs" aria-label="Fil d'Ariane">${crumbs.map((c, i) => (i === crumbs.length - 1 ? `<span aria-current="page">${esc(c.name)}</span>` : `<a href="${c.url}">${esc(c.name)}</a>`)).join(" › ")}</nav>
<main>
<h1>${p.h1}</h1>
<p class="lead">${p.lead}</p>
${p.body}
</main>
<footer>
  <div class="cols">
    <div><b>Apprendre</b><a href="/france/departements">Liste des départements</a><a href="/france/carte-des-departements">Carte des départements</a><a href="/france/prefectures">Liste des préfectures</a><a href="/france">Toute la France</a></div>
    <div><b>Quiz</b><a href="/quiz/departements">Placer les départements</a><a href="/quiz/numeros-des-departements">Numéros des départements</a><a href="/quiz/prefectures">Préfectures</a><a href="/quiz">Tous les quiz</a></div>
    <div><b>Régions</b>${REGIONS.filter((r) => !["01", "02", "03", "04", "06"].includes(r.code)).map((r) => `<a href="${regionUrl(r)}">${esc(r.nom)}</a>`).join("")}<a href="${regionUrl(REGION.get("04")!)}">Outre-mer</a></div>
  </div>
  <p>Hexa est un jeu gratuit, sans publicité ni traceur, pour apprendre les départements français : les placer sur la carte, leur numéro, leur préfecture. <a href="/#a-propos">À propos</a></p>
</footer>
</body>
</html>`;
}

/** Fiches question / réponse visibles sur la page, balisées pour Google (« Questions-réponses éducatives »). */
function flashcards(about: string, cards: [string, string][]) {
  const html = `<section class="cards"><h2>À retenir</h2><dl>${cards.map(([q, a]) => `<div><dt>${esc(q)}</dt><dd>${esc(a)}</dd></div>`).join("")}</dl></section>`;
  const ld = {
    "@context": "https://schema.org", "@type": "Quiz", about: { "@type": "Thing", name: about }, inLanguage: "fr",
    educationalLevel: "débutant", hasPart: cards.map(([q, a]) => ({ "@type": "Question", eduQuestionType: "Flashcard", text: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return { html, ld };
}
function faq(items: [string, string][]) {
  return {
    html: `<section class="faq"><h2>Questions fréquentes</h2>${items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join("")}</section>`,
    ld: { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a.replace(/<[^>]+>/g, "") } })) },
  };
}
const cta = (title: string, text: string, href: string, label: string, more = "") =>
  `<aside class="cta"><div><b>${title}</b><p>${text}</p></div><a class="btn" href="${href}">${label}</a>${more}</aside>`;
const GAME = { "@type": "VideoGame", name: "Hexa", url: SITE, inLanguage: "fr", genre: ["Quiz", "Éducatif", "Géographie"], gamePlatform: ["Navigateur web", "Mobile"], applicationCategory: "EducationalApplication", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" } };

// =====================================================================================================
// Atlas France
// =====================================================================================================
// Ordre officiel : la Corse (2A, 2B) à la place de l'ancien 20, entre le 19 et le 21.
const numKey = (c: string) => (c === "2A" ? 20.1 : c === "2B" ? 20.2 : Number(c));
const byNum = [...DEPARTEMENTS].sort((a, b) => numKey(a.code) - numKey(b.code));
const depsOf = (r: Region) => DEPARTEMENTS.filter((d) => d.region === r.code);
const depLink = (d: Departement) => `<a href="${depUrl(d)}">${esc(d.nom)}</a>`;

// ---------- une page par département ----------
for (const [i, d] of byNum.entries()) {
  const r = REGION.get(d.region)!;
  const others = depsOf(r);
  const prev = byNum[i - 1], next = byNum[i + 1];
  const voisins = d.limitrophes.map((c) => DEP.get(c)!).filter(Boolean);
  const sp = d.sousPrefectures;
  const fc = flashcards(`${d.nom} (département ${d.code})`, [
    [`Quel est le numéro ${de(d)} ?`, d.code],
    [`Quelle est la préfecture ${de(d)} ?`, d.prefecture],
    [`Dans quelle région se trouve ${withArticle(d)} ?`, r.nom],
    ...(sp.length ? [[`Quelles sont les sous-préfectures ${de(d)} ?`, fmtList(sp)] as [string, string]] : []),
    ...(voisins.length ? [[`Quels sont les départements voisins ${de(d)} ?`, fmtList(voisins.map((v) => `${v.nom} (${v.code})`))] as [string, string]] : []),
    [`Quel département porte le numéro ${d.code} ?`, d.nom],
  ]);
  const place = { "@context": "https://schema.org", "@type": "AdministrativeArea", name: d.nom, identifier: d.code, url: SITE + depUrl(d), containedInPlace: { "@type": "AdministrativeArea", name: r.nom, url: SITE + regionUrl(r) }, containsPlace: [d.prefecture, ...sp].map((n) => ({ "@type": "City", name: n })) };
  const titleBase = `${d.nom} (${d.code}) : préfecture, carte, sous-préfectures et voisins`;
  pages.push({
    path: depUrl(d), atlas: "france",
    og: { kicker: `Département n° ${d.code} · ${d.outreMer ? "Outre-mer" : r.nom}`, title: d.nom, facts: [`Préfecture : ${d.prefecture}`, ...(sp.length ? [`${sp.length} sous-préfecture${sp.length > 1 ? "s" : ""}`] : [])], highlight: [d.code], zone: d.outreMer ? [d.code] : undefined, tint: d.outreMer ? [] : DEPARTEMENTS.filter((x) => x.region === d.region).map((x) => x.code) },
    title: titleBase.length <= 62 ? `${titleBase} | Hexa` : titleBase,
    description: `${sujet(d)} (${d.code}) ${est(d)} un département ${deRegion(r)}. Préfecture : ${d.prefecture}.${sp.length ? ` Sous-préfectures : ${sp.join(", ")}.` : ""} Fiche, carte et quiz gratuit sur Hexa.`,
    h1: `${esc(d.nom)} (${d.code})`,
    lead: `${esc(sujet(d))} ${est(d)} le département n<sup>o</sup>&nbsp;<b>${d.code}</b>, ${esc(enRegion(r))}. Sa préfecture est <b>${esc(d.prefecture)}</b>.`,
    crumbs: [{ name: "France", url: "/france" }, { name: "Départements", url: "/france/departements" }, { name: r.nom, url: regionUrl(r) }, { name: d.nom, url: depUrl(d) }],
    jsonld: [place, fc.ld],
    body: `<div class="split">
<figure>${svgMap(others.map((x) => x.code), { highlight: d.code, outline: [r.code], labels: true, title: `${d.nom} sur la carte de la région ${r.nom}` })}<figcaption>${esc(cap(withArticle(d)))} sur la carte ${esc(deRegion(r))}. Touche un département pour sa fiche.</figcaption></figure>
<section class="fiche"><h2>Fiche ${esc(de(d))}</h2><dl>
<dt>Numéro</dt><dd>${d.code}</dd>
<dt>Préfecture</dt><dd>${esc(d.prefecture)}</dd>
<dt>Sous-préfectures</dt><dd>${sp.length ? esc(fmtList(sp)) : "aucune"}</dd>
<dt>Région</dt><dd><a href="${regionUrl(r)}">${esc(r.nom)}</a></dd>
<dt>Voisins</dt><dd>${voisins.length ? voisins.map((v) => `${depLink(v)} (${v.code})`).join(", ") : d.outreMer ? "aucun (outre-mer)" : "aucun (île)"}</dd>
</dl></section></div>
${cta(`Sauras-tu placer ${esc(withArticle(d))} sur une carte vierge ?`, `Hexa te fait jouer ${esc(enRegion(r))} : le placer, son numéro, sa préfecture. Deux minutes par jour, gratuit.`, `/#region=${tourCode(d)}`, `Jouer ${esc(enRegion(r))}`)}
${fc.html}
<section><h2>Dans l'ordre des numéros</h2><p>${prev ? `Juste avant : ${depLink(prev)} (${prev.code}).` : ""} ${next ? `Juste après : ${depLink(next)} (${next.code}).` : ""} De 01 à 89, les numéros suivent l'ordre alphabétique des noms des départements à l'époque : voir la <a href="/france/departements">liste des 101 départements</a>.</p></section>
<section><h2>Les ${others.length} départements ${esc(deRegion(r))}</h2><ul class="chips">${others.map((x) => `<li${x.code === d.code ? ' class="on"' : ""}><a href="${depUrl(x)}"><b>${x.code}</b> ${esc(x.nom)}</a></li>`).join("")}</ul></section>`,
  });
}

// ---------- une page par région ----------
for (const r of REGIONS) {
  const ds = depsOf(r);
  const om = ["01", "02", "03", "04", "06"].includes(r.code);
  const fc = flashcards(`Région ${r.nom}`, [
    [`Combien de départements compte la région ${r.nom} ?`, String(ds.length)],
    [`Quel est le chef-lieu de la région ${r.nom} ?`, r.chefLieu],
    [`Quels sont les départements ${deRegion(r)} ?`, fmtList(ds.map((d) => `${d.nom} (${d.code})`))],
  ]);
  pages.push({
    path: regionUrl(r), atlas: "france",
    og: { kicker: ds.length > 1 ? `Région · ${ds.length} départements` : `Région d'outre-mer · n° ${ds[0].code}`, title: r.nom, facts: [`Chef-lieu : ${r.chefLieu}`], highlight: ds.map((d) => d.code), zone: om ? ds.map((d) => d.code) : undefined },
    title: om ? `${r.nom} : département et région d'outre-mer (${ds[0].code}) | Hexa` : `Départements ${deRegion(r)} : liste, numéros, carte et préfectures`,
    description: `${ds.length > 1 ? `Les ${ds.length} départements ${deRegion(r)}` : `Le département ${deRegion(r)}`} : ${ds.map((d) => `${d.nom} (${d.code})`).join(", ")}. Préfectures, carte et quiz pour les apprendre en jouant.`,
    h1: ds.length > 1 ? `Les départements ${esc(deRegion(r))}` : `${esc(r.nom)} (${ds[0].code})`,
    lead: ds.length > 1 ? `La région <b>${esc(r.nom)}</b> compte <b>${ds.length} départements</b>. Son chef-lieu est <b>${esc(r.chefLieu)}</b>.` : `${esc(r.nom)} est à la fois une région et un département d'outre-mer, n<sup>o</sup>&nbsp;<b>${ds[0].code}</b>. Son chef-lieu est <b>${esc(r.chefLieu)}</b>.`,
    crumbs: [{ name: "France", url: "/france" }, { name: "Régions", url: "/france/regions" }, { name: r.nom, url: regionUrl(r) }],
    jsonld: [{ "@context": "https://schema.org", "@type": "AdministrativeArea", name: r.nom, url: SITE + regionUrl(r), containsPlace: ds.map((d) => ({ "@type": "AdministrativeArea", name: d.nom, identifier: d.code, url: SITE + depUrl(d) })) }, fc.ld],
    body: `<div class="split">
<figure>${svgMap(ds.map((d) => d.code), { outline: [r.code], labels: true, title: `Carte des départements ${deRegion(r)}`, tint: false })}<figcaption>Carte ${esc(deRegion(r))} avec les numéros. Touche un département pour sa fiche.</figcaption></figure>
<section class="fiche"><h2>Liste</h2><table><thead><tr><th>N°</th><th>Département</th><th>Préfecture</th></tr></thead><tbody>${ds.map((d) => `<tr><td>${d.code}</td><td>${depLink(d)}</td><td>${esc(d.prefecture)}</td></tr>`).join("")}</tbody></table></section></div>
${cta(ds.length > 1 ? `Apprendre les départements ${esc(deRegion(r))} en jouant` : `Apprendre ${esc(r.nom)} en jouant`, "Une séance de 2 minutes : on te demande de les placer, leur numéro, leur préfecture. Ce que tu rates revient plus tard.", `/#region=${om ? OUTRE_MER : r.code}`, "Jouer cette région", `<a class="link" href="/quiz/regions">ou apprendre les 18 régions</a>`)}
${fc.html}
<section><h2>Les autres régions</h2><ul class="chips">${REGIONS.filter((x) => x.code !== r.code).map((x) => `<li><a href="${regionUrl(x)}">${esc(x.nom)}</a></li>`).join("")}</ul></section>`,
  });
}

// ---------- liste des départements ----------
{
  const f = faq([
    ["Combien y a-t-il de départements en France ?", "La France compte <b>101 départements</b> : 96 en métropole (Corse comprise) et 5 en outre-mer (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte)."],
    ["Pourquoi la Corse a-t-elle les numéros 2A et 2B ?", "La Corse portait le numéro 20. Elle a été divisée en deux départements en 1976 : la Corse-du-Sud (2A) et la Haute-Corse (2B). Le numéro 20 n'est plus utilisé."],
    ["D'où viennent les numéros des départements ?", "De 01 (Ain) à 89 (Yonne), ils suivent l'ordre alphabétique des noms des départements à l'époque où la numérotation a été fixée. Les départements renommés depuis semblent « mal placés » : les Côtes-d'Armor (22) s'appelaient Côtes-du-Nord. Le Territoire de Belfort a le 90, les départements d'Île-de-France créés en 1968 les numéros 91 à 95, et l'outre-mer 971 à 976."],
    ["Quel est le département avec le plus grand numéro ?", `<a href="${depUrl(DEP.get("976")!)}">Mayotte</a>, n° 976, devenue le 101e département en 2011.`],
    ["Comment apprendre les départements rapidement ?", `Par petites séances régulières, région par région, en se testant plutôt qu'en relisant. C'est ce que fait <a href="/">Hexa</a> : 2 minutes par jour, et ce que tu rates revient plus tard.`],
  ]);
  pages.push({
    path: "/france/departements", atlas: "france", type: "article",
    title: "Liste des 101 départements français : numéros, préfectures et régions",
    description: "La liste complète des 101 départements de France, de l'Ain (01) à Mayotte (976) : numéro, préfecture et région de chacun. Avec une carte et un quiz gratuit pour les apprendre.",
    h1: "Liste des 101 départements français",
    lead: "Les <b>101 départements</b> de France, par numéro : 96 en métropole, 5 en outre-mer. Touche un nom pour sa fiche (carte, préfecture, sous-préfectures, voisins).",
    crumbs: [{ name: "France", url: "/france" }, { name: "Départements", url: "/france/departements" }],
    jsonld: [{ "@context": "https://schema.org", "@type": "ItemList", name: "Départements français", numberOfItems: 101, itemListElement: byNum.map((d, i) => ({ "@type": "ListItem", position: i + 1, name: `${d.nom} (${d.code})`, url: SITE + depUrl(d) })) }, f.ld],
    body: `${cta("Tu les connais vraiment ?", "Teste-toi sur la carte, les numéros et les préfectures, à ton rythme.", "/quiz/departements", "Faire le quiz")}
<table class="big"><thead><tr><th>N°</th><th>Département</th><th>Préfecture</th><th>Région</th></tr></thead><tbody>${byNum.map((d) => `<tr><td>${d.code}</td><td>${depLink(d)}</td><td>${esc(d.prefecture)}</td><td><a href="${regionUrl(REGION.get(d.region)!)}">${esc(REGION.get(d.region)!.nom)}</a></td></tr>`).join("")}</tbody></table>
<section id="regions"><h2>Par région</h2><ul class="chips">${REGIONS.map((r) => `<li><a href="${regionUrl(r)}">${esc(r.nom)} <small>${depsOf(r).length}</small></a></li>`).join("")}</ul></section>
${f.html}`,
  });
}

// ---------- liste des préfectures ----------
{
  const byPref = [...DEPARTEMENTS].sort((a, b) => a.prefecture.localeCompare(b.prefecture, "fr"));
  pages.push({
    path: "/france/prefectures", atlas: "france",
    title: "Liste des préfectures de France par département (101 préfectures)",
    description: "Les 101 préfectures françaises par ordre alphabétique, avec leur département et leur numéro : d'Ajaccio (2A) à Vesoul (70). Et un quiz gratuit pour les retenir.",
    h1: "Liste des préfectures de France",
    lead: "Chaque département a une <b>préfecture</b>, la ville où siège l'État dans le département. Voici les 101, par ordre alphabétique.",
    crumbs: [{ name: "France", url: "/france" }, { name: "Préfectures", url: "/france/prefectures" }],
    jsonld: [{ "@context": "https://schema.org", "@type": "ItemList", name: "Préfectures françaises", numberOfItems: 101, itemListElement: byPref.map((d, i) => ({ "@type": "ListItem", position: i + 1, name: `${d.prefecture} (${d.nom}, ${d.code})`, url: SITE + depUrl(d) })) }],
    body: `${cta("Sauras-tu les retrouver ?", "Le quiz des préfectures : on te donne le département, tu trouves sa préfecture. Au clavier ou parmi des propositions.", "/quiz/prefectures", "Quiz des préfectures")}
<table class="big"><thead><tr><th>Préfecture</th><th>Département</th><th>N°</th></tr></thead><tbody>${byPref.map((d) => `<tr><td>${esc(d.prefecture)}</td><td>${depLink(d)}</td><td>${d.code}</td></tr>`).join("")}</tbody></table>`,
  });
}

// ---------- carte des départements ----------
{
  const all = DEPARTEMENTS.map((d) => d.code);
  const b = { x: -180, y: -10, w: 1190, h: 948 };
  const paths = map.paths as Record<string, string>;
  const frames = (map.insets as { code: string; x: number; y: number; w: number; h: number }[]).map((i) => `<rect x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" rx="8"/>`).join("");
  const svg = `<svg class="map big" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" role="img" aria-label="Carte des départements de France avec leurs numéros">
<g class="frames">${frames}</g>
<g class="shadow" transform="translate(4 4)">${all.filter((c) => !DEP.get(c)!.outreMer).map((c) => `<path d="${paths[c]}"/>`).join("")}</g>
<g class="deps">${all.map((c) => { const d = DEP.get(c)!; return `<a href="${depUrl(d)}" aria-label="${esc(d.nom)} (${c})"><path d="${paths[c]}" fill="${tintOf(d.region)}"/></a>`; }).join("")}</g>
<g class="outline">${Object.entries(map.regions as Record<string, string>).map(([, p]) => `<path d="${p}"/>`).join("")}</g>
<g class="labels" font-size="11">${all.filter((c) => LABELS[c] && !["75", "92", "93", "94"].includes(c)).map((c) => `<text x="${LABELS[c][0]}" y="${LABELS[c][1]}">${c}</text>`).join("")}</g></svg>`;
  const f = faq([
    ["Où trouver une carte des départements avec les numéros ?", "Juste au-dessus : chaque département porte son numéro, et le toucher ouvre sa fiche (préfecture, sous-préfectures, voisins). Paris et la petite couronne (75, 92, 93, 94) sont détaillés dans la fiche de l'Île-de-France."],
    ["Comment apprendre la carte des départements ?", `Région par région, en essayant de placer chaque département sur une carte vierge plutôt qu'en regardant la carte. Le <a href="/quiz/departements">quiz des départements</a> d'Hexa fait exactement ça.`],
    ["Combien de départements sur la carte de France ?", "101 : 96 en métropole et 5 en outre-mer, représentés dans les encadrés à gauche."],
  ]);
  pages.push({
    path: "/france/carte-des-departements", atlas: "france",
    title: "Carte des départements de France avec numéros (interactive)",
    description: "Carte de France des 101 départements avec leurs numéros, métropole et outre-mer. Touche un département pour sa préfecture et ses voisins, puis teste-toi sur une carte vierge.",
    h1: "Carte des départements de France",
    lead: "Les <b>101 départements</b> avec leurs numéros, couleur par région. Touche un département pour ouvrir sa fiche.",
    crumbs: [{ name: "France", url: "/france" }, { name: "Carte des départements", url: "/france/carte-des-departements" }],
    jsonld: [f.ld],
    body: `<figure class="wide">${svg}<figcaption>Les encadrés à gauche : Guadeloupe (971), Martinique (972), Guyane (973), La Réunion (974), Mayotte (976).</figcaption></figure>
${cta("Et sur une carte vierge ?", "Place chaque département sans les noms : le meilleur moyen de retenir la carte.", "/#entrainement=carte", "Jouer sur la carte vierge")}
${f.html}`,
  });
}

// ---------- atlas Régions : la liste des 18 régions, avec leur carte (docs/atlas.md) ----------
/** Carte des 13 régions de métropole, chacune cliquable vers sa page. */
function regionsSvg(): string {
  const outl = map.regions as Record<string, string>;
  const codes = Object.keys(outl);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const centers: Record<string, Pt> = {};
  for (const c of codes) {
    let a = Infinity, b = Infinity, e = -Infinity, f = -Infinity;
    for (const [x, y] of pathPts(outl[c])) { a = Math.min(a, x); b = Math.min(b, y); e = Math.max(e, x); f = Math.max(f, y); }
    centers[c] = [(a + e) / 2, (b + f) / 2];
    x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, e); y1 = Math.max(y1, f);
  }
  const k = Math.max(x1 - x0, y1 - y0), pad = k * 0.04;
  const name = (c: string) => REGION.get(c)!;
  return `<svg class="map big" viewBox="${(x0 - pad).toFixed(1)} ${(y0 - pad).toFixed(1)} ${(x1 - x0 + 2 * pad).toFixed(1)} ${(y1 - y0 + 2 * pad).toFixed(1)}" role="img" aria-label="Carte des 13 régions de France métropolitaine">
<g class="shadow" transform="translate(${(k * 0.008).toFixed(2)} ${(k * 0.008).toFixed(2)})">${codes.map((c) => `<path d="${outl[c]}"/>`).join("")}</g>
<g class="deps">${codes.map((c) => `<a href="${regionUrl(name(c))}" aria-label="${esc(name(c).nom)}"><path d="${outl[c]}" fill="${tintOf(c)}"/></a>`).join("")}</g>
<g class="labels" font-size="${(k * 0.026).toFixed(1)}">${codes.map((c) => `<text x="${centers[c][0].toFixed(1)}" y="${centers[c][1].toFixed(1)}">${esc(name(c).chefLieu)}</text>`).join("")}</g></svg>`;
}
{
  const f = faq([
    ["Combien y a-t-il de régions en France ?", "La France compte <b>18 régions</b> : 13 en métropole (Corse comprise) et 5 en outre-mer (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte), depuis la réforme de 2016."],
    ["Quelle est la différence entre une région et un département ?", "Une région regroupe plusieurs départements (de 2 à 13 en métropole). En outre-mer, chaque région n'a qu'un seul département, du même nom."],
    ["Quel est le chef-lieu d'une région ?", "La ville où siège le préfet de région et, le plus souvent, le conseil régional : Rennes pour la Bretagne, Lyon pour l'Auvergne-Rhône-Alpes, Marseille pour Provence-Alpes-Côte d'Azur…"],
    ["Quelle est la plus grande région ?", `<a href="${regionUrl(REGION.get("75")!)}">La Nouvelle-Aquitaine</a> en métropole, avec 12 départements ; mais la plus vaste de France est <a href="${regionUrl(REGION.get("03")!)}">la Guyane</a>.`],
  ]);
  const rows = [...REGIONS].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  pages.push({
    path: "/france/regions", atlas: "regions", type: "article",
    title: "Les 18 régions de France : liste, carte et chefs-lieux | Hexa",
    description: "Les 18 régions françaises : la carte, leur chef-lieu et leurs départements, de l'Auvergne-Rhône-Alpes à Mayotte. Avec un quiz gratuit pour les apprendre.",
    h1: "Les 18 régions de France",
    lead: "La France compte <b>18 régions</b> : <b>13 en métropole</b> et <b>5 en outre-mer</b>. Voici leur carte, leur chef-lieu et les départements qu'elles regroupent.",
    crumbs: [{ name: "France", url: "/france" }, { name: "Régions", url: "/france/regions" }],
    jsonld: [{ "@context": "https://schema.org", "@type": "ItemList", name: "Régions de France", numberOfItems: 18, itemListElement: rows.map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.nom, url: SITE + regionUrl(r) })) }, f.ld],
    body: `<div class="split">
<figure>${regionsSvg()}<figcaption>Les 13 régions de métropole et leur chef-lieu. Touche une région pour sa page.</figcaption></figure>
<section class="fiche"><h2>Liste</h2><table><thead><tr><th>Région</th><th>Chef-lieu</th><th>Dép.</th></tr></thead><tbody>${rows.map((r) => `<tr><td><a href="${regionUrl(r)}">${esc(r.nom)}</a></td><td>${esc(r.chefLieu)}</td><td>${depsOf(r).length}</td></tr>`).join("")}</tbody></table></section></div>
${cta("Les connais-tu par cœur ?", "Place chaque région sur une carte vierge, puis trouve son chef-lieu. Deux minutes par jour suffisent.", "/#entrainement=regions-carte", "Lancer le quiz des régions", `<a class="link" href="/quiz/chefs-lieux-des-regions">ou celui des chefs-lieux</a>`)}
${f.html}`,
  });
}

// ---------- quiz (sommaire commun à tous les atlas, sous /quiz) ----------
interface Quiz { path: string; name: string; title: string; description: string; h1: string; lead: string; how: string[]; preset: string; faq: [string, string][]; atlas: string }
const QUIZZES: Quiz[] = [
  {
    path: "/quiz/departements", name: "Placer les départements", atlas: "france", preset: "carte",
    title: "Quiz des départements français : place-les sur la carte (gratuit)",
    description: "Quiz gratuit pour apprendre les 101 départements français : place-les sur une carte vierge, région par région, de Découverte à Expert. Sans pub, sur mobile et ordinateur.",
    h1: "Quiz des départements français",
    lead: "Une carte vierge, un nom de département : à toi de le placer. Région par région, à ton rythme, et ce que tu rates revient plus tard jusqu'à ce que tu le saches.",
    how: ["On te donne un département, tu le touches sur la carte.", "Au début, 4 départements sont surlignés pour t'aider ; ensuite, toute la carte.", "Chaque bonne réponse sans aide te donne une étoile ; les 3 étoiles d'un département, sa médaille."],
    faq: [
      ["Ce quiz est-il gratuit ?", "Oui, entièrement, sans publicité ni traceur. Un compte (gratuit) sert seulement à garder ta progression sur plusieurs appareils et à entrer au classement."],
      ["Ça marche sur téléphone ?", "Oui : la carte se zoome au doigt, et Hexa s'installe comme une appli depuis le navigateur."],
      ["Combien de temps pour apprendre les 101 départements ?", "Avec une séance de 2 minutes par jour, la plupart des joueurs connaissent leur région en quelques jours et toute la France en quelques semaines."],
    ],
  },
  {
    path: "/quiz/numeros-des-departements", name: "Numéros des départements", atlas: "france", preset: "numeros",
    title: "Quiz des numéros de départements : le 29, le 69, le 974… (gratuit)",
    description: "Quiz gratuit sur les numéros des départements français : retrouve le numéro de chaque département, ou le département derrière chaque numéro. Propositions ou clavier.",
    h1: "Quiz des numéros de départements",
    lead: "Le 29 ? Le 69 ? Le 2A ? Retrouve le numéro de chaque département, ou le département derrière chaque numéro (pratique pour les plaques et les codes postaux).",
    how: ["On te donne un département (son nom ou sa forme sur la carte), tu trouves son numéro.", "Réponds parmi 4 propositions ou au clavier, comme tu préfères.", "Les numéros ratés reviennent dans tes séances suivantes."],
    faq: [
      ["Comment retenir les numéros des départements ?", "De 01 à 89, ils suivent l'ordre alphabétique des anciens noms : l'Ain est le 01, l'Yonne le 89. Retenir quelques repères (13 Bouches-du-Rhône, 33 Gironde, 59 Nord, 69 Rhône, 75 Paris) aide à placer les autres."],
      ["Pourquoi pas de département 20 ?", "La Corse (20) a été divisée en 1976 en Corse-du-Sud (2A) et Haute-Corse (2B)."],
    ],
  },
  {
    path: "/quiz/prefectures", name: "Préfectures", atlas: "france", preset: "prefectures",
    title: "Quiz des préfectures de France : les 101 préfectures (gratuit)",
    description: "Quiz gratuit sur les préfectures françaises : retrouve la préfecture de chaque département, de Bourg-en-Bresse à Mamoudzou. Propositions ou clavier, sans pub.",
    h1: "Quiz des préfectures de France",
    lead: "Quimper, Mende, Bar-le-Duc… Retrouve la préfecture de chacun des 101 départements, au clavier ou parmi des propositions qui se ressemblent.",
    how: ["On te donne un département, tu trouves sa préfecture.", "Au clavier, les petites fautes de frappe sont tolérées.", "En mode Expert, on te demande aussi les sous-préfectures."],
    faq: [
      ["Quelle différence entre préfecture et chef-lieu ?", "Pour un département, c'est la même ville : la préfecture est le chef-lieu, où siège le préfet. Une région a aussi un chef-lieu, souvent la préfecture d'un de ses départements."],
      ["Quelle est la préfecture du Val-d'Oise ?", `Le chef-lieu officiel est Pontoise, mais les services de la préfecture sont à Cergy : les deux réponses sont acceptées dans Hexa. Voir la <a href="${depUrl(DEP.get("95")!)}">fiche du Val-d'Oise</a>.`],
    ],
  },
];
QUIZZES.push(
  {
    path: "/quiz/regions", name: "Placer les régions", atlas: "regions", preset: "regions-carte",
    title: "Quiz des régions de France : place les 18 régions sur la carte (gratuit)",
    description: "Quiz gratuit pour apprendre les 18 régions françaises : place-les sur une carte vierge, puis trouve leur chef-lieu. Sans pub, sur mobile et ordinateur.",
    h1: "Quiz des régions de France",
    lead: "Une carte vierge, un nom de région : à toi de la placer. Puis son chef-lieu, et en expert ses départements et ses voisines.",
    how: ["On te donne une région, tu la touches sur la carte.", "Au début, 4 régions sont surlignées pour t'aider ; ensuite, toute la carte.", "Chaque bonne réponse sans aide te donne une étoile ; les 2 étoiles d'une région, sa médaille."],
    faq: [
      ["Combien de régions faut-il connaître ?", "18 : 13 en métropole et 5 en outre-mer. C'est un bon début avant les 101 départements."],
      ["Ce quiz est-il gratuit ?", "Oui, entièrement, sans publicité ni traceur. Un compte (gratuit) sert seulement à garder ta progression et à entrer au classement."],
    ],
  },
  {
    path: "/quiz/chefs-lieux-des-regions", name: "Chefs-lieux des régions", atlas: "regions", preset: "regions-chefs-lieux",
    title: "Quiz des chefs-lieux de région : Rennes, Lyon, Dijon… (gratuit)",
    description: "Quiz gratuit sur les chefs-lieux des 18 régions françaises : retrouve la capitale de chaque région, de Rennes à Mamoudzou. Propositions ou clavier.",
    h1: "Quiz des chefs-lieux de région",
    lead: "Dijon ou Besançon ? Orléans ou Tours ? Retrouve le chef-lieu de chacune des 18 régions.",
    how: ["On te donne une région (son nom ou sa forme sur la carte), tu trouves son chef-lieu.", "Réponds parmi 4 propositions ou au clavier.", "Les chefs-lieux ratés reviennent dans tes séances suivantes."],
    faq: [
      ["Quel est le chef-lieu de la Bourgogne-Franche-Comté ?", "Dijon. Besançon accueille le conseil régional, mais le chef-lieu (siège du préfet de région) est Dijon."],
      ["Quel est le chef-lieu de la Normandie ?", "Rouen, même si le conseil régional siège à Caen."],
    ],
  },
);
for (const q of QUIZZES) {
  const f = faq(q.faq);
  pages.push({
    path: q.path, atlas: q.atlas, type: "website",
    title: q.title, description: q.description, h1: esc(q.h1), lead: esc(q.lead),
    crumbs: [{ name: "Quiz", url: "/quiz" }, { name: q.name, url: q.path }],
    jsonld: [{ "@context": "https://schema.org", ...GAME, name: `${q.h1} · Hexa`, url: SITE + q.path, description: q.description }, f.ld],
    body: `${cta("C'est parti", "Gratuit, sans inscription, sur téléphone comme sur ordinateur.", `/#entrainement=${q.preset}`, "Lancer le quiz", `<a class="link" href="/#defi">ou le défi du jour</a>`)}
<section><h2>Comment ça marche</h2><ol class="steps">${q.how.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>
<section><h2>Trois niveaux</h2><ul class="levels"><li><b>Découverte</b> On te donne toujours le nom ou la carte, avec des propositions faciles.</li><li><b>Confirmé</b> Tous les indices, au clavier ou parmi des propositions qui se ressemblent.</li><li><b>Expert</b> En plus : ${q.atlas === "regions" ? "les départements de chaque région et ses voisines" : "les sous-préfectures et les départements voisins"}.</li></ul></section>
${f.html}
<section><h2>Pour réviser</h2><ul class="chips">${q.atlas === "regions" ? `<li><a href="/france/regions">Les 18 régions</a></li><li><a href="/france/departements">Liste des départements</a></li>` : `<li><a href="/france/departements">Liste des départements</a></li><li><a href="/france/carte-des-departements">Carte des départements</a></li><li><a href="/france/prefectures">Liste des préfectures</a></li><li><a href="/france/regions">Les 18 régions</a></li>`}</ul></section>`,
  });
}

// ---------- sommaires : /quiz (tous atlas) et /france (l'atlas) ----------
pages.push({
  path: "/quiz", type: "website",
  title: "Quiz de géographie gratuits : départements, régions, préfectures | Hexa",
  description: "Tous les quiz d'Hexa pour apprendre la géographie en jouant : départements et régions sur la carte, numéros, préfectures, chefs-lieux. Gratuits, sans pub, avec un défi chaque jour.",
  h1: "Les quiz d'Hexa", lead: "Des quiz courts pour apprendre en jouant, sur mobile ou ordinateur. Ce que tu rates revient plus tard, jusqu'à ce que tu le saches.",
  crumbs: [{ name: "Quiz", url: "/quiz" }],
  jsonld: [{ "@context": "https://schema.org", "@type": "ItemList", itemListElement: QUIZZES.map((q, i) => ({ "@type": "ListItem", position: i + 1, name: q.h1, url: SITE + q.path })) }],
  body: `<section><h2>Départements</h2><div class="tiles">${QUIZZES.filter((q) => q.atlas === "france").map((q) => `<a class="tile" href="${q.path}"><b>${esc(q.h1)}</b><span>${esc(q.lead)}</span></a>`).join("")}<a class="tile" href="/#defi"><b>Le défi du jour</b><span>Les mêmes 10 départements pour tout le monde, à ton niveau, et un classement.</span></a></div></section>
<section><h2>Régions</h2><div class="tiles">${QUIZZES.filter((q) => q.atlas === "regions").map((q) => `<a class="tile" href="${q.path}"><b>${esc(q.h1)}</b><span>${esc(q.lead)}</span></a>`).join("")}</div></section>`,
});
pages.push({
  path: "/france", type: "website", atlas: "france",
  title: "Apprendre les départements français : liste, carte, préfectures et quiz",
  description: "Tout pour apprendre les 101 départements français : liste avec numéros, carte interactive, préfectures, fiches par département et quiz gratuits.",
  h1: "Les départements français", lead: "Les 101 départements : leur place sur la carte, leur numéro, leur préfecture. Pour réviser et pour jouer.",
  crumbs: [{ name: "France", url: "/france" }],
  body: `<div class="tiles"><a class="tile" href="/france/departements"><b>Liste des départements</b><span>Les 101, par numéro, avec préfecture et région.</span></a><a class="tile" href="/france/carte-des-departements"><b>Carte des départements</b><span>Avec les numéros, cliquable.</span></a><a class="tile" href="/france/prefectures"><b>Liste des préfectures</b><span>Par ordre alphabétique.</span></a><a class="tile" href="/quiz/departements"><b>Quiz</b><span>Placer, numéros, préfectures.</span></a><a class="tile" href="/france/regions"><b>Les 18 régions</b><span>Carte, chefs-lieux, quiz.</span></a></div>
<section><h2>Par région</h2><ul class="chips">${REGIONS.map((r) => `<li><a href="${regionUrl(r)}">${esc(r.nom)} <small>${depsOf(r).length}</small></a></li>`).join("")}</ul></section>`,
});

// =====================================================================================================
// Écriture : pages, plan du site par atlas, robots, 404, styles et polices
// =====================================================================================================
for (const p of pages) write(p.path, layout(p));
let ogCount = 0;
for (const p of pages) if (p.og) { renderOg(p.path, p.og); ogCount++; }

const atlases = [...new Set(pages.map((p) => p.atlas ?? "site"))];
mkdirSync(new URL("sitemaps/", DIST), { recursive: true });
const urlset = (paths: string[]) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `<url><loc>${SITE}${p}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}\n</urlset>\n`;
for (const a of atlases) writeFileSync(new URL(`sitemaps/${a}.xml`, DIST), urlset(pages.filter((p) => (p.atlas ?? "site") === a).map((p) => p.path).concat(a === "site" ? ["/"] : [])));
writeFileSync(new URL("sitemap.xml", DIST), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${atlases.map((a) => `<sitemap><loc>${SITE}/sitemaps/${a}.xml</loc><lastmod>${TODAY}</lastmod></sitemap>`).join("\n")}\n</sitemapindex>\n`);
writeFileSync(new URL("robots.txt", DIST), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
writeFileSync(new URL("404.html", DIST), layout({
  path: "/404", title: "Page introuvable | Hexa", description: "Cette page n'existe pas.", h1: "Page introuvable",
  lead: "Cette adresse ne mène nulle part. Peut-être cherchais-tu un département ?", crumbs: [],
  body: `<ul class="chips"><li><a href="/">Jouer à Hexa</a></li><li><a href="/france/departements">Liste des départements</a></li><li><a href="/france/carte-des-departements">Carte</a></li><li><a href="/quiz">Quiz</a></li></ul>`,
}).replace(`<link rel="canonical" href="${SITE}/404">`, '<meta name="robots" content="noindex">'));

mkdirSync(new URL("seo/fonts/", DIST), { recursive: true });
const FONTS = new URL("../node_modules/@fontsource/", import.meta.url);
copyFileSync(new URL("gabarito/files/gabarito-latin-600-normal.woff2", FONTS), new URL("seo/fonts/gabarito-600.woff2", DIST));
copyFileSync(new URL("gabarito/files/gabarito-latin-800-normal.woff2", FONTS), new URL("seo/fonts/gabarito-800.woff2", DIST));
copyFileSync(new URL("bowlby-one/files/bowlby-one-latin-400-normal.woff2", FONTS), new URL("seo/fonts/bowlby.woff2", DIST));
copyFileSync(new URL("./seo.css", import.meta.url), new URL("seo/seo.css", DIST));
console.log(`[seo] ${pages.length} pages, ${ogCount} images d'aperçu, ${atlases.length} plans du site (${atlases.join(", ")})`);
