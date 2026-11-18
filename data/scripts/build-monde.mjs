// Construit packages/data/src/monde.json (atlas Monde, docs/atlas.md) :
//   - les 195 pays (193 membres de l'ONU + Vatican et Palestine, États observateurs), en français, avec leur capitale ;
//   - leurs voisins terrestres (arcs partagés dans la topologie) ;
//   - la carte (projection Natural Earth), avec un rond cliquable pour les pays trop petits pour être touchés.
// Source des contours : Natural Earth 1:50m admin 0 (domaine public), data/sources/monde.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mapshaper from "mapshaper";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(root, "data", "sources", "monde", "ne_50m_admin_0_countries.geojson");
const OUT = join(root, "packages", "data", "src", "monde.json");

// ---------- Les pays ----------
// code (ADM0_A3 de Natural Earth) | nom | article | capitale | continent | autres noms acceptés | autres capitales acceptées
// Continents (groupes de séance) : EU Europe, AF Afrique, AS Asie, NA Amérique du Nord et centrale, SA Amérique du Sud, OC Océanie.
const PAYS = `
AFG|Afghanistan|l'|Kaboul|AS||Kabul
ZAF|Afrique du Sud|l'|Pretoria|AF||Le Cap;Bloemfontein
ALB|Albanie|l'|Tirana|EU
DZA|Algérie|l'|Alger|AF
DEU|Allemagne|l'|Berlin|EU
AND|Andorre|l'|Andorre-la-Vieille|EU
AGO|Angola|l'|Luanda|AF
ATG|Antigua-et-Barbuda||Saint John's|NA|Antigua
SAU|Arabie saoudite|l'|Riyad|AS||Riyadh
ARG|Argentine|l'|Buenos Aires|SA
ARM|Arménie|l'|Erevan|AS||Yerevan
AUS|Australie|l'|Canberra|OC
AUT|Autriche|l'|Vienne|EU
AZE|Azerbaïdjan|l'|Bakou|AS||Baku
BHS|Bahamas|les|Nassau|NA
BHR|Bahreïn||Manama|AS|Bahrein
BGD|Bangladesh|le|Dacca|AS||Dhaka
BRB|Barbade|la|Bridgetown|NA
BEL|Belgique|la|Bruxelles|EU
BLZ|Belize|le|Belmopan|NA
BEN|Bénin|le|Porto-Novo|AF
BTN|Bhoutan|le|Thimphou|AS||Thimphu
BLR|Biélorussie|la|Minsk|EU|Bélarus
MMR|Birmanie|la|Naypyidaw|AS|Myanmar|Naypyitaw;Nay Pyi Taw
BOL|Bolivie|la|Sucre|SA||La Paz
BIH|Bosnie-Herzégovine|la|Sarajevo|EU|Bosnie
BWA|Botswana|le|Gaborone|AF
BRA|Brésil|le|Brasília|SA
BRN|Brunei|le|Bandar Seri Begawan|AS
BGR|Bulgarie|la|Sofia|EU
BFA|Burkina Faso|le|Ouagadougou|AF|Burkina
BDI|Burundi|le|Gitega|AF||Bujumbura
KHM|Cambodge|le|Phnom Penh|AS
CMR|Cameroun|le|Yaoundé|AF
CAN|Canada|le|Ottawa|NA
CPV|Cap-Vert|le|Praia|AF|Cabo Verde
CAF|Centrafrique|la|Bangui|AF|République centrafricaine
CHL|Chili|le|Santiago|SA|
CHN|Chine|la|Pékin|AS||Beijing
CYP|Chypre||Nicosie|EU
COL|Colombie|la|Bogota|SA
COM|Comores|les|Moroni|AF
COG|Congo|le|Brazzaville|AF|République du Congo;Congo-Brazzaville
COD|RD Congo|la|Kinshasa|AF|RDC;République démocratique du Congo;Congo-Kinshasa
PRK|Corée du Nord|la|Pyongyang|AS
KOR|Corée du Sud|la|Séoul|AS
CRI|Costa Rica|le|San José|NA
CIV|Côte d'Ivoire|la|Yamoussoukro|AF
HRV|Croatie|la|Zagreb|EU
CUB|Cuba||La Havane|NA
DNK|Danemark|le|Copenhague|EU
DJI|Djibouti||Djibouti|AF
DMA|Dominique|la|Roseau|NA
EGY|Égypte|l'|Le Caire|AF
ARE|Émirats arabes unis|les|Abou Dabi|AS|Émirats|Abu Dhabi
ECU|Équateur|l'|Quito|SA
ERI|Érythrée|l'|Asmara|AF
ESP|Espagne|l'|Madrid|EU
EST|Estonie|l'|Tallinn|EU
SWZ|Eswatini|l'|Mbabane|AF|Swaziland|Lobamba
USA|États-Unis|les|Washington|NA|USA
ETH|Éthiopie|l'|Addis-Abeba|AF
FJI|Fidji|les|Suva|OC
FIN|Finlande|la|Helsinki|EU
FRA|France|la|Paris|EU
GAB|Gabon|le|Libreville|AF
GMB|Gambie|la|Banjul|AF
GEO|Géorgie|la|Tbilissi|AS
GHA|Ghana|le|Accra|AF
GRC|Grèce|la|Athènes|EU
GRD|Grenade|la|Saint-Georges|NA
GTM|Guatemala|le|Guatemala|NA||Ciudad de Guatemala
GIN|Guinée|la|Conakry|AF
GNB|Guinée-Bissau|la|Bissau|AF
GNQ|Guinée équatoriale|la|Malabo|AF
GUY|Guyana|le|Georgetown|SA
HTI|Haïti||Port-au-Prince|NA
HND|Honduras|le|Tegucigalpa|NA
HUN|Hongrie|la|Budapest|EU
IND|Inde|l'|New Delhi|AS||Delhi
IDN|Indonésie|l'|Jakarta|AS
IRQ|Irak|l'|Bagdad|AS|Iraq
IRN|Iran|l'|Téhéran|AS
IRL|Irlande|l'|Dublin|EU
ISL|Islande|l'|Reykjavik|EU
ISR|Israël||Jérusalem|AS||Tel Aviv
ITA|Italie|l'|Rome|EU
JAM|Jamaïque|la|Kingston|NA
JPN|Japon|le|Tokyo|AS
JOR|Jordanie|la|Amman|AS
KAZ|Kazakhstan|le|Astana|AS
KEN|Kenya|le|Nairobi|AF
KGZ|Kirghizistan|le|Bichkek|AS
KIR|Kiribati||Tarawa|OC
KWT|Koweït|le|Koweït|AS||Koweït City
LAO|Laos|le|Vientiane|AS
LSO|Lesotho|le|Maseru|AF
LVA|Lettonie|la|Riga|EU
LBN|Liban|le|Beyrouth|AS
LBR|Liberia|le|Monrovia|AF
LBY|Libye|la|Tripoli|AF
LIE|Liechtenstein|le|Vaduz|EU
LTU|Lituanie|la|Vilnius|EU
LUX|Luxembourg|le|Luxembourg|EU
MKD|Macédoine du Nord|la|Skopje|EU|Macédoine
MDG|Madagascar||Antananarivo|AF||Tananarive
MYS|Malaisie|la|Kuala Lumpur|AS
MWI|Malawi|le|Lilongwe|AF
MDV|Maldives|les|Malé|AS
MLI|Mali|le|Bamako|AF
MLT|Malte||La Valette|EU
MAR|Maroc|le|Rabat|AF
MHL|Îles Marshall|les|Majuro|OC|Marshall
MUS|Maurice||Port-Louis|AF|Île Maurice
MRT|Mauritanie|la|Nouakchott|AF
MEX|Mexique|le|Mexico|NA
FSM|Micronésie|la|Palikir|OC
MDA|Moldavie|la|Chișinău|EU|Moldova|Chisinau;Kichinev
MCO|Monaco||Monaco|EU
MNG|Mongolie|la|Oulan-Bator|AS||Oulan Bator;Ulaanbaatar
MNE|Monténégro|le|Podgorica|EU
MOZ|Mozambique|le|Maputo|AF
NAM|Namibie|la|Windhoek|AF
NRU|Nauru||Yaren|OC
NPL|Népal|le|Katmandou|AS||Kathmandu
NIC|Nicaragua|le|Managua|NA
NER|Niger|le|Niamey|AF
NGA|Nigeria|le|Abuja|AF
NOR|Norvège|la|Oslo|EU
NZL|Nouvelle-Zélande|la|Wellington|OC
OMN|Oman||Mascate|AS||Muscat
UGA|Ouganda|l'|Kampala|AF
UZB|Ouzbékistan|l'|Tachkent|AS
PAK|Pakistan|le|Islamabad|AS
PLW|Palaos|les|Ngerulmud|OC|Palau|Melekeok
PSX|Palestine|la|Ramallah|AS||Jérusalem-Est
PAN|Panama|le|Panama|NA
PNG|Papouasie-Nouvelle-Guinée|la|Port Moresby|OC
PRY|Paraguay|le|Asuncion|SA
NLD|Pays-Bas|les|Amsterdam|EU|Hollande
PER|Pérou|le|Lima|SA
PHL|Philippines|les|Manille|AS
POL|Pologne|la|Varsovie|EU
PRT|Portugal|le|Lisbonne|EU
QAT|Qatar|le|Doha|AS
DOM|République dominicaine|la|Saint-Domingue|NA
CZE|Tchéquie|la|Prague|EU|République tchèque
ROU|Roumanie|la|Bucarest|EU
GBR|Royaume-Uni|le|Londres|EU|Angleterre;Grande-Bretagne
RUS|Russie|la|Moscou|EU
RWA|Rwanda|le|Kigali|AF
KNA|Saint-Christophe-et-Niévès||Basseterre|NA|Saint-Kitts-et-Nevis
SMR|Saint-Marin||Saint-Marin|EU
VCT|Saint-Vincent-et-les-Grenadines||Kingstown|NA|Saint-Vincent
LCA|Sainte-Lucie||Castries|NA
SLB|Îles Salomon|les|Honiara|OC|Salomon
SLV|Salvador|le|San Salvador|NA|El Salvador
WSM|Samoa|les|Apia|OC
STP|Sao Tomé-et-Principe||Sao Tomé|AF
SEN|Sénégal|le|Dakar|AF
SRB|Serbie|la|Belgrade|EU
SYC|Seychelles|les|Victoria|AF
SLE|Sierra Leone|la|Freetown|AF
SGP|Singapour||Singapour|AS
SVK|Slovaquie|la|Bratislava|EU
SVN|Slovénie|la|Ljubljana|EU
SOM|Somalie|la|Mogadiscio|AF
SDN|Soudan|le|Khartoum|AF
SDS|Soudan du Sud|le|Djouba|AF||Juba
LKA|Sri Lanka|le|Sri Jayawardenepura Kotte|AS||Kotte;Colombo
SWE|Suède|la|Stockholm|EU
CHE|Suisse|la|Berne|EU
SUR|Suriname|le|Paramaribo|SA
SYR|Syrie|la|Damas|AS
TJK|Tadjikistan|le|Douchanbé|AS||Dushanbe
TZA|Tanzanie|la|Dodoma|AF
TCD|Tchad|le|N'Djaména|AF
THA|Thaïlande|la|Bangkok|AS
TLS|Timor oriental|le|Dili|AS|Timor-Leste
TGO|Togo|le|Lomé|AF
TON|Tonga|les|Nuku'alofa|OC
TTO|Trinité-et-Tobago||Port-d'Espagne|NA||Port of Spain
TUN|Tunisie|la|Tunis|AF
TKM|Turkménistan|le|Achgabat|AS
TUR|Turquie|la|Ankara|AS
TUV|Tuvalu||Funafuti|OC
UKR|Ukraine|l'|Kiev|EU||Kyiv;Kyïv
URY|Uruguay|l'|Montevideo|SA
VUT|Vanuatu|le|Port-Vila|OC
VAT|Vatican|le|Vatican|EU|Cité du Vatican;Saint-Siège|Cité du Vatican
VEN|Venezuela|le|Caracas|SA
VNM|Viêt Nam|le|Hanoï|AS|Vietnam
YEM|Yémen|le|Sanaa|AS
ZMB|Zambie|la|Lusaka|AF
ZWE|Zimbabwe|le|Harare|AF
`.trim().split("\n").map((l) => {
  const [code, nom, article, capitale, continent, alias = "", capAlias = ""] = l.split("|");
  const list = (s) => s.split(";").map((x) => x.trim()).filter(Boolean);
  return { code, nom, article, capitale, continent, alias: list(alias), capAlias: list(capAlias) };
});
const BY = new Map(PAYS.map((p) => [p.code, p]));
if (BY.size !== PAYS.length) throw new Error("code en double");

// Territoires rattachés à un pays de la liste (même forme) : ce que l'ONU compte dans ce pays.
const MERGE = { SOL: "SOM", CYN: "CYP", HKG: "CHN", MAC: "CHN", ALD: "FIN", KAS: "IND" };

// ---------- Géométrie ----------
const raw = JSON.parse(readFileSync(SRC, "utf8"));
for (const f of raw.features) {
  const a3 = f.properties.ADM0_A3;
  const code = MERGE[a3] ?? a3;
  // Notoriété (Natural Earth : rang d'étiquette, puis population) : les pays connus se découvrent d'abord.
  if (BY.has(a3)) Object.assign(BY.get(a3), { iso2: f.properties.ISO_A2_EH.toLowerCase(), rang: f.properties.LABELRANK * 20 - f.properties.POP_RANK });
  f.properties = { code: BY.has(code) ? code : "", fond: BY.has(code) ? 0 : 1, a3 };
}
const geo = JSON.stringify({ type: "FeatureCollection", features: raw.features.filter((f) => f.properties.a3 !== "ATA") });
const run = (cmd, files) => mapshaper.applyCommands(cmd, files);

// 1) Voisins : arcs partagés (géométrie non simplifiée, pays fusionnés)
const voisins = new Map(PAYS.map((p) => [p.code, new Set()]));
{
  const out = await run(`-i in.json snap -filter 'code != ""' -dissolve code -o out.json format=topojson`, { "in.json": geo });
  const topo = JSON.parse(out["out.json"]);
  const obj = Object.values(topo.objects)[0];
  const owners = new Map();
  const walk = (arcs, code) => {
    for (const a of arcs) {
      if (Array.isArray(a)) walk(a, code);
      else { const k = a < 0 ? ~a : a; if (!owners.has(k)) owners.set(k, new Set()); owners.get(k).add(code); }
    }
  };
  for (const g of obj.geometries) walk(g.arcs, g.properties.code);
  for (const set of owners.values()) if (set.size > 1) for (const a of set) for (const b of set) if (a !== b) voisins.get(a).add(b);
}

// 2) Tracés : projection Natural Earth, simplifiée, sans l'Antarctique.
const W = 1000;
const out = await run(
  `-i in.json snap -dissolve code,fond copy-fields=fond -proj +proj=natearth -simplify 12% keep-shapes ` +
  `-filter-islands min-area=40km2 remove-empty -o out.json format=geojson`,
  { "in.json": geo },
);
const fc = JSON.parse(out["out.json"]);
let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
const walkPts = (c, f) => (typeof c[0] === "number" ? f(c) : c.forEach((x) => walkPts(x, f)));
for (const f of fc.features) walkPts(f.geometry.coordinates, ([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
const scale = W / (x1 - x0);
const r1 = (n) => Math.round(n * 10) / 10;
const pt = ([x, y]) => [r1((x - x0) * scale), r1((y1 - y) * scale)];
const H = r1((y1 - y0) * scale);

function pathOf(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  let d = "";
  // Cadre de la plus grande île (le rond d'un archipel se pose dessus, pas au milieu de l'océan).
  let box = [0, 0, 0, 0], best = -1;
  for (const poly of polys) for (const ring of poly) {
    const pts = ring.map(pt);
    const kept = [pts[0]];
    for (const p of pts.slice(1)) { const q = kept[kept.length - 1]; if (p[0] !== q[0] || p[1] !== q[1]) kept.push(p); }
    if (kept.length < 4) continue;
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of kept) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    const size = (b[2] - b[0]) * (b[3] - b[1]);
    if (size > best) { best = size; box = b; }
    d += "M" + kept.slice(0, -1).map((p) => p.join(",")).join("L") + "Z";
  }
  return { d, box };
}

const paths = {}, dots = {};
let fond = "";
// Pays trop petits pour le doigt (îles, micro-États) : un rond cliquable par-dessus, centré sur le pays.
const SMALL = 7, DOT = 4.2;
for (const f of fc.features) {
  if (!f.geometry) continue;
  const { d, box } = pathOf(f.geometry);
  if (f.properties.fond || !f.properties.code) { fond += d; continue; }
  const code = f.properties.code;
  const w = box[2] - box[0], h = box[3] - box[1];
  if (Math.max(w, h) < SMALL) dots[code] = [r1((box[0] + box[2]) / 2), r1((box[1] + box[3]) / 2)];
  paths[code] = d;
}
// Les plus petits ont pu disparaître à la simplification : on les place d'après la source.
const missing = PAYS.filter((p) => !paths[p.code]);
if (missing.length) {
  const o2 = await run(`-i in.json -filter '${missing.map((p) => `code == "${p.code}"`).join(" || ")}' -dissolve code -points inner -proj +proj=natearth -o out.json format=geojson`, { "in.json": geo });
  for (const f of JSON.parse(o2["out.json"]).features) { dots[f.properties.code] = pt(f.geometry.coordinates); paths[f.properties.code] = ""; }
}
const still = PAYS.filter((p) => paths[p.code] === undefined);
if (still.length) throw new Error("Pays sans tracé : " + still.map((p) => p.code).join(", "));

const items = PAYS.map((p) => ({
  code: "W" + p.code, iso2: p.iso2, rang: p.rang, nom: p.nom, article: p.article, capitale: p.capitale, continent: p.continent,
  limitrophes: [...voisins.get(p.code)].map((c) => "W" + c).sort(),
  ...(p.alias.length ? { alias: p.alias } : {}), ...(p.capAlias.length ? { capAlias: p.capAlias } : {}),
})).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

writeFileSync(OUT, JSON.stringify({
  viewBox: [0, 0, W, H],
  items,
  paths: Object.fromEntries(Object.entries(paths).map(([c, d]) => ["W" + c, d])),
  dots: Object.fromEntries(Object.entries(dots).map(([c, p]) => ["W" + c, p])),
  fond,
}));
console.log(`${items.length} pays, ${Object.keys(dots).length} petits pays en rond, carte ${W}×${H}, ${(readFileSync(OUT).length / 1024).toFixed(0)} Ko`);
