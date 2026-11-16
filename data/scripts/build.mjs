// Construit packages/data/src/{departements,regions,map}.json à partir des sources officielles.
// Sources : INSEE COG 2025 (départements, arrondissements, communes, régions)
//           + contours france-geojson (gregoiredavid, Licence Ouverte, d'après IGN/ADMIN EXPRESS).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mapshaper from "mapshaper";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = (f) => join(root, "data", "sources", f);
const outDir = join(root, "packages", "data", "src");
mkdirSync(outDir, { recursive: true });

// ---------- CSV ----------
function parseCsv(text) {
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const csv = (f) => parseCsv(readFileSync(src(f), "utf8"));

// TNCC INSEE -> article à utiliser devant le nom
const ARTICLE = { 0: "", 1: "", 2: "le", 3: "la", 4: "les", 5: "l'", 6: "aux", 7: "las", 8: "los" };

const communes = new Map(csv("v_commune.csv").filter((c) => c.TYPECOM === "COM").map((c) => [c.COM, c.LIBELLE]));
const regions = csv("v_region.csv").map((r) => ({ code: r.REG, nom: r.LIBELLE, chefLieu: communes.get(r.CHEFLIEU) }));
const regionByCode = new Map(regions.map((r) => [r.code, r]));
const arrs = csv("v_arrondissement.csv");

function cheflieu(code) {
  const n = communes.get(code);
  if (!n) throw new Error(`Commune chef-lieu introuvable : ${code}`);
  return n;
}

const deps = csv("v_departement.csv").map((d) => {
  const prefecture = cheflieu(d.CHEFLIEU);
  const sousPrefectures = arrs
    .filter((a) => a.DEP === d.DEP && a.CHEFLIEU !== d.CHEFLIEU)
    .map((a) => cheflieu(a.CHEFLIEU))
    .sort((a, b) => a.localeCompare(b, "fr"));
  return {
    code: d.DEP,
    nom: d.LIBELLE,
    article: ARTICLE[d.TNCC] ?? "",
    region: d.REG,
    prefecture,
    sousPrefectures: [...new Set(sousPrefectures)],
    outreMer: d.DEP.length === 3,
    limitrophes: [],
  };
});
const depByCode = new Map(deps.map((d) => [d.code, d]));

// ---------- Géométrie ----------
async function run(cmd, input) {
  const out = await mapshaper.applyCommands(cmd, input);
  return out;
}
const geoRaw = JSON.parse(readFileSync(src("dep-om.geojson"), "utf8"));
for (const f of geoRaw.features) f.properties.region = depByCode.get(f.properties.code)?.region ?? "";
const geo = JSON.stringify(geoRaw);

// 1) Limitrophes : arcs partagés dans la topologie (géométrie non simplifiée)
{
  const out = await run("-i in.json snap -o out.json format=topojson", { "in.json": geo });
  const topo = JSON.parse(out["out.json"]);
  const obj = Object.values(topo.objects)[0];
  const arcOwners = new Map();
  const walk = (arcs, code) => {
    for (const a of arcs) {
      if (Array.isArray(a)) walk(a, code);
      else {
        const k = a < 0 ? ~a : a;
        if (!arcOwners.has(k)) arcOwners.set(k, new Set());
        arcOwners.get(k).add(code);
      }
    }
  };
  for (const g of obj.geometries) walk(g.arcs, g.properties.code);
  for (const owners of arcOwners.values()) {
    if (owners.size < 2) continue;
    for (const a of owners) for (const b of owners) if (a !== b) {
      const d = depByCode.get(a);
      if (d && !d.limitrophes.includes(b)) d.limitrophes.push(b);
    }
  }
  for (const d of deps) d.limitrophes.sort();
}

// 2) Tracés SVG
const W = 1000; // largeur de la métropole en unités SVG
const LAMBERT93 = "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m";

async function projected(filter, proj, pct, withRegions = false) {
  const dissolve = withRegions ? `-dissolve region + name=regions -o regions.json format=geojson target=regions ` : "";
  const out = await run(
    `-i in.json snap name=deps -filter '${filter}' -proj ${proj} -simplify ${pct} keep-shapes ${dissolve}-o out.json format=geojson target=deps`,
    { "in.json": geo },
  );
  const fc = JSON.parse(out["out.json"]);
  if (withRegions) fc.regions = JSON.parse(out["regions.json"]);
  return fc;
}

function bbox(fc) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const w = (c) => {
    if (typeof c[0] === "number") { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); }
    else c.forEach(w);
  };
  fc.features.forEach((f) => w(f.geometry.coordinates));
  return [x0, y0, x1, y1];
}

// Convertit des coordonnées projetées (y vers le haut) en chemin SVG dans une boîte donnée.
function toPaths(fc, box, scale, key = "code", origin = null) {
  const [x0, , , y1] = origin ?? bbox(fc);
  const r = (n) => Math.round(n * 10) / 10;
  const pt = ([x, y]) => [r(box.x + (x - x0) * scale), r(box.y + (y1 - y) * scale)];
  const paths = {}, centers = {};
  for (const f of fc.features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    let d = "";
    for (const poly of polys) for (const ring of poly) {
      const pts = ring.map(pt);
      const kept = [pts[0]];
      for (const p of pts.slice(1)) {
        const q = kept[kept.length - 1];
        if (p[0] !== q[0] || p[1] !== q[1]) kept.push(p);
      }
      if (kept.length < 4) continue;
      d += "M" + kept.slice(0, -1).map((p) => p.join(",")).join("L") + "Z";
    }
    paths[f.properties[key]] = d;
  }
  return { paths, pt };
}

async function labelPoints(filter, proj, pt) {
  const out = await run(`-i in.json snap -filter '${filter}' -proj ${proj} -points inner -o out.json format=geojson`, { "in.json": geo });
  const res = {};
  for (const f of JSON.parse(out["out.json"]).features) res[f.properties.code] = pt(f.geometry.coordinates);
  return res;
}

const metroFilter = "code.length == 2";
const metro = await projected(metroFilter, `'${LAMBERT93}'`, "7%", true);
const [mx0, my0, mx1, my1] = bbox(metro);
const mScale = W / (mx1 - mx0);
const metroH = Math.round((my1 - my0) * mScale);
const metroBox = { x: 0, y: 0, w: W, h: metroH };
const m = toPaths(metro, metroBox, mScale);
const regionPaths = toPaths(metro.regions, metroBox, mScale, "region", bbox(metro)).paths;
const paths = { ...m.paths };
const labels = await labelPoints(metroFilter, `'${LAMBERT93}'`, m.pt);

// Encarts outre-mer : colonne à gauche de la métropole, chaque territoire mis à l'échelle de sa boîte.
const INSET = 150, GAP = 20;
const insets = [];
const drom = deps.filter((d) => d.outreMer);
for (const [i, d] of drom.entries()) {
  const filter = `code == "${d.code}"`;
  const fc = await projected(filter, "merc", "12%");
  const [x0, y0, x1, y1] = bbox(fc);
  const s = (INSET - 20) / Math.max(x1 - x0, y1 - y0);
  const bw = (x1 - x0) * s, bh = (y1 - y0) * s;
  const box = { x: -INSET - GAP, y: i * (INSET + GAP), w: INSET, h: INSET };
  const inner = { x: box.x + (INSET - bw) / 2, y: box.y + (INSET - bh) / 2, w: bw, h: bh };
  const p = toPaths(fc, inner, s);
  Object.assign(paths, p.paths);
  Object.assign(labels, await labelPoints(filter, "merc", p.pt));
  insets.push({ code: d.code, ...box });
}

// Zone de zoom Paris + petite couronne (le front affiche un encart agrandi)
function pathBox(codes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of codes) for (const [, x, y] of paths[c].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) {
    x0 = Math.min(x0, +x); x1 = Math.max(x1, +x); y0 = Math.min(y0, +y); y1 = Math.max(y1, +y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const zooms = [{ id: "idf", codes: ["75", "92", "93", "94"], ...pathBox(["75", "92", "93", "94"]) }];

const top = 0, left = -INSET - GAP;
const map = {
  viewBox: [left - 10, top - 10, W - left + 20, Math.max(metroH, drom.length * (INSET + GAP)) + 20],
  insets,
  zooms,
  labels,
  paths,
  /** Contours des régions de métropole (même topologie que les départements). */
  regions: regionPaths,
};

// ---------- Contrôles ----------
const problems = [];
if (deps.length !== 101) problems.push(`${deps.length} départements au lieu de 101`);
for (const d of deps) {
  if (!paths[d.code]) problems.push(`pas de tracé pour ${d.code}`);
  if (!regionByCode.has(d.region)) problems.push(`région inconnue pour ${d.code}`);
  if (!d.outreMer && d.code !== "2A" && d.code !== "2B" && d.limitrophes.length === 0) problems.push(`aucun voisin pour ${d.code}`);
}
for (const d of deps) for (const n of d.limitrophes) if (!depByCode.get(n)?.limitrophes.includes(d.code)) problems.push(`voisinage asymétrique ${d.code}/${n}`);
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }

const usedRegions = regions.filter((r) => deps.some((d) => d.region === r.code));
writeFileSync(join(outDir, "departements.json"), JSON.stringify(deps, null, 1) + "\n");
writeFileSync(join(outDir, "regions.json"), JSON.stringify(usedRegions, null, 1) + "\n");
writeFileSync(join(outDir, "map.json"), JSON.stringify(map));
console.log(`OK : ${deps.length} départements, ${usedRegions.length} régions, ${deps.reduce((n, d) => n + d.sousPrefectures.length, 0)} sous-préfectures, ${deps.reduce((n, d) => n + d.limitrophes.length, 0) / 2} frontières, map.json ${(JSON.stringify(map).length / 1024).toFixed(0)} Ko`);
