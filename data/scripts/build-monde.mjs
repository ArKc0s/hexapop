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
const OUT_CARTE = join(root, "packages", "data", "src", "monde-carte.json");

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
ISR|Israël||Jérusalem|AS||Tel-Aviv;Tel Aviv
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
PSX|Palestine|la|Jérusalem-Est|AS|État de Palestine|Ramallah;Jérusalem
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
// Capitales au statut contesté : demandées comme les autres (ne rien demander serait aussi une prise de position), avec
// les réponses défendables acceptées et une note factuelle, montrée sur la fiche et à la correction.
const CAP_NOTE = {
  ISR: "Proclamée capitale par Israël, où siègent le gouvernement et le Parlement ; statut contesté, la plupart des ambassades sont à Tel-Aviv (accepté aussi).",
  PSX: "Capitale proclamée en 1988 ; les institutions siègent à Ramallah (accepté aussi).",
};
for (const p of PAYS) if (CAP_NOTE[p.code]) p.capNote = CAP_NOTE[p.code];
const BY = new Map(PAYS.map((p) => [p.code, p]));
if (BY.size !== PAYS.length) throw new Error("code en double");

// Territoires rattachés à un pays de la liste, sans contestation : Hong Kong et Macao (Chine), Åland (Finlande).
// Somaliland et Chypre du Nord : rattachés à la Somalie et à Chypre seulement pour calculer les voisins (États reconnus
// par l'ONU) ; sur la carte, ce sont des zones disputées, en gris (ci-dessous).
const MERGE = { SOL: "SOM", CYN: "CYP", HKG: "CHN", MAC: "CHN", ALD: "FIN" };

// Neutralité (demande de Léo, 2026-11-18 : « on se base sur des faits avérés uniquement ») :
// - la liste suit un critère vérifiable : les 193 États membres de l'ONU et ses 2 États observateurs ;
// - les frontières sont celles de Natural Earth, et toute zone que Natural Earth signale comme disputée ou sécessionniste
//   avec une revendication (Crimée, Golan, Cachemire, Abkhazie, Kouriles…) est en gris, attribuée à personne et jamais
//   demandée. Exceptions factuelles : Bornéo du Nord (aucune revendication notée) et l'Artsakh (république
//   autoproclamée dissoute le 1er janvier 2024, territoire sous administration de l'Azerbaïdjan, État reconnu).
const DISPUTES = join(root, "data", "sources", "monde", "ne_50m_admin_0_breakaway_disputed_areas.geojson");
const disputed = JSON.parse(readFileSync(DISPUTES, "utf8"));
disputed.features = disputed.features
  .filter((f) => /claimed/i.test(f.properties.NOTE_BRK ?? "") && f.properties.BRK_NAME !== "Artsakh")
  .map((f) => ({ ...f, properties: { code: "", fond: 1, a3: "DIS" } }));

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

// 2) Tracés : projection Natural Earth centrée sur 11° E (le Pacifique coupé à 169° O : les Fidji, les Samoa et les
// Tonga restent entiers, à droite de l'Océanie), simplifiée, sans l'Antarctique.
const W = 1000;
const PROJ = "+proj=natearth +lon_0=11";
const out = await run(
  `-i combine-files in.json dis.json snap -erase dis target=in -dissolve code,fond copy-fields=fond target=in ` +
  // Assez de détail pour un continent en plein écran (la carte se regarde zoomée), coordonnées au dixième (moins d'un pixel, même zoomé sur l'Europe).
  `-merge-layers target=in,dis force name=all -proj ${PROJ} -simplify 30% keep-shapes ` +
  `-filter-islands min-area=40km2 remove-empty ` +
  // Le trait de côte (toutes les terres fondues) : un contour épais à l'encre, comme les régions sur la carte de France.
  `-dissolve + name=land -o out.json format=geojson target=all -o land.json format=geojson target=land`,
  { "in.json": geo, "dis.json": JSON.stringify(disputed) },
);
const fc = JSON.parse(out["out.json"]);
const landFc = JSON.parse(out["land.json"]);
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
  const o2 = await run(`-i in.json -filter '${missing.map((p) => `code == "${p.code}"`).join(" || ")}' -dissolve code -points inner -proj ${PROJ} -o out.json format=geojson`, { "in.json": geo });
  for (const f of JSON.parse(o2["out.json"]).features) { dots[f.properties.code] = pt(f.geometry.coordinates); paths[f.properties.code] = ""; }
}
const still = PAYS.filter((p) => paths[p.code] === undefined);
if (still.length) throw new Error("Pays sans tracé : " + still.map((p) => p.code).join(", "));

// Cadres des continents (accueil, album : un continent remplit la colonne, la carte entière est deux fois plus large
// que haute). Rectangles en longitude / latitude, projetés point par point comme la carte (un polygone serait coupé
// à la couture du Pacifique).
const VIEWS = {
  EU: [-25, 34, 45, 71.5], AF: [-26, -36, 60, 38], AS: [25, -12, 150, 56],
  NA: [-168, 6, -52, 72], SA: [-83, -56, -33, 13], OC: [110, -48, 190, 22],
};
const rect = ([a, b, c, d]) => {
  const ring = [];
  for (let i = 0; i <= 40; i++) ring.push([a + ((c - a) * i) / 40, b]);
  for (let i = 0; i <= 40; i++) ring.push([c, b + ((d - b) * i) / 40]);
  for (let i = 0; i <= 40; i++) ring.push([c - ((c - a) * i) / 40, d]);
  for (let i = 0; i <= 40; i++) ring.push([a, d - ((d - b) * i) / 40]);
  return ring;
};
const vOut = await run(`-i in.json -proj ${PROJ} -o out.json format=geojson`, { "in.json": JSON.stringify({ type: "FeatureCollection", features: Object.entries(VIEWS).map(([k, v]) => ({ type: "Feature", properties: { k }, geometry: { type: "MultiPoint", coordinates: rect(v).map(([x, y]) => [x > 180 ? x - 360 : x, y]) } })) }) });
const views = {};
for (const f of JSON.parse(vOut["out.json"]).features) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  walkPts(f.geometry.coordinates, (c) => { const [x, y] = pt(c); b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); });
  views["W" + f.properties.k] = [r1(b[0]), r1(b[1]), r1(b[2] - b[0]), r1(b[3] - b[1])];
}

const items = PAYS.map((p) => ({
  code: "W" + p.code, iso2: p.iso2, rang: p.rang, nom: p.nom, article: p.article, capitale: p.capitale, continent: p.continent,
  limitrophes: [...voisins.get(p.code)].map((c) => "W" + c).sort(),
  ...(p.alias.length ? { alias: p.alias } : {}), ...(p.capAlias.length ? { capAlias: p.capAlias } : {}), ...(p.capNote ? { capNote: p.capNote } : {}),
})).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

// Deux fichiers : la liste (petite, pour le jeu et le serveur) et la carte (lourde, chargée par l'appli seulement
// quand l'atlas Monde est proposé).
writeFileSync(OUT, JSON.stringify({ items }));
writeFileSync(OUT_CARTE, JSON.stringify({
  viewBox: [0, 0, W, H],
  paths: Object.fromEntries(Object.entries(paths).map(([c, d]) => ["W" + c, d])),
  dots: Object.fromEntries(Object.entries(dots).map(([c, p]) => ["W" + c, p])),
  fond,
  cote: (landFc.features?.map((f) => f.geometry) ?? landFc.geometries ?? [landFc]).filter(Boolean).map((g) => pathOf(g).d).join(""),
  views,
}));
console.log(JSON.stringify(views));
console.log(`${items.length} pays, ${Object.keys(dots).length} petits pays en rond, carte ${W}×${H}, liste ${(readFileSync(OUT).length / 1024).toFixed(0)} Ko, carte ${(readFileSync(OUT_CARTE).length / 1024).toFixed(0)} Ko`);
