// Service worker d'Hexa : notifications, et le jeu jouable hors ligne (séances, entraînement) quand le serveur
// ou la connexion manquent. Le défi, le multi et les comptes ont besoin du serveur ; le reste tourne dans le navigateur.
const SHELL = "hexa-shell-v1";
const ASSET_RE = /\/assets\/[\w.\-]+/g;

/** Met en cache la page et tous les fichiers qu'elle référence ; retire les fichiers des versions précédentes. */
async function cacheShell(html) {
  const cache = await caches.open(SHELL);
  const assets = [...new Set(html.match(ASSET_RE) ?? [])];
  await Promise.all(assets.map(async (a) => { if (!(await cache.match(a))) await cache.add(a).catch(() => {}); }));
  for (const req of await cache.keys()) {
    const p = new URL(req.url).pathname;
    if (p.startsWith("/assets/") && !assets.includes(p)) await cache.delete(req);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    const res = await fetch("/", { cache: "no-store" }).catch(() => null);
    if (res && res.ok) { await cache.put("/", res.clone()); await cacheShell(await res.text()); }
    await cache.addAll(["/manifest.webmanifest", "/favicon.svg", "/icon-192.png"]).catch(() => {});
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== SHELL) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") {
    // Page : le réseau d'abord (nouvelle version), la copie si le serveur ne répond pas ou renvoie une erreur
    // (Cloudflare répond 52x quand le serveur est éteint).
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.status < 500) {
          if (res.ok && url.pathname === "/") {
            const copy = res.clone();
            event.waitUntil((async () => { const cache = await caches.open(SHELL); await cache.put("/", copy.clone()); await cacheShell(await copy.text()); })());
          }
          return res;
        }
        throw new Error(`HTTP ${res.status}`);
      } catch {
        return (await caches.match("/")) ?? Response.error();
      }
    })());
    return;
  }
  // Fichiers de l'appli (noms uniques par version) : la copie d'abord, sinon le réseau.
  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && url.pathname.startsWith("/assets/")) { const cache = await caches.open(SHELL); cache.put(req, res.clone()); }
    return res;
  })());
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Hexa", body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(data.title || "Hexa", {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "hexa",
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) { await w.focus(); return w.navigate(url); }
    }
    return self.clients.openWindow(url);
  })());
});
