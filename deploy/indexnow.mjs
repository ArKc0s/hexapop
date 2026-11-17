// IndexNow : prévient Bing (et Yandex, Seznam, Naver…) des pages du site qui ont changé, juste après un déploiement.
// Lit le plan du site en ligne, compare chaque page à son empreinte du dernier envoi (deploy/.indexnow.json, local),
// et n'envoie que les pages nouvelles ou modifiées. La clé est publique par principe : /<clé>.txt sur le site.
// Lancé par deploy.sh ; à la main : node deploy/indexnow.mjs
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const SITE = "https://hexapop.app";
const here = new URL("./", import.meta.url);
const KEY = readdirSync(new URL("../apps/web/public/", here)).map((f) => /^([0-9a-f]{32})\.txt$/.exec(f)?.[1]).find(Boolean);
if (!KEY) { console.log("[indexnow] pas de clé dans apps/web/public"); process.exit(0); }
const STATE = new URL(".indexnow.json", here);
let seen = {};
try { seen = JSON.parse(readFileSync(STATE, "utf8")); } catch { /* premier envoi */ }

const get = async (u) => { const r = await fetch(u, { headers: { "user-agent": "hexa-indexnow" } }); if (!r.ok) throw new Error(`${u} : ${r.status}`); return r.text(); };
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const urls = [];
for (const sm of locs(await get(`${SITE}/sitemap.xml`))) urls.push(...locs(await get(sm)));

const changed = [], next = {};
for (const u of urls) {
  try {
    const h = createHash("sha256").update(await get(u)).digest("hex").slice(0, 16);
    next[u] = h;
    if (seen[u] !== h) changed.push(u);
  } catch (e) { console.log(`[indexnow] ${e.message}`); if (seen[u]) next[u] = seen[u]; }
}
if (!changed.length) { console.log(`[indexnow] ${urls.length} pages, rien de nouveau`); process.exit(0); }
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST", headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: changed.slice(0, 10_000) }),
});
console.log(`[indexnow] ${changed.length} page(s) signalée(s) sur ${urls.length} : HTTP ${res.status}`);
if (res.ok) writeFileSync(STATE, JSON.stringify(next));
