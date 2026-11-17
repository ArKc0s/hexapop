// Présence anonyme pour les stats en direct (Grafana) : toutes les minutes, et à chaque changement d'écran,
// l'onglet dit où il est. Identifiant tiré au hasard à chaque chargement de page, jamais gardé. Voir apps/server/src/live.ts.
import { nav } from "./nav.svelte.ts";

const id = (() => { try { return crypto.randomUUID(); } catch { return Math.random().toString(36).slice(2) + Date.now().toString(36); } })();

function screen(): string {
  const s = nav.screen;
  if (s.name === "home") return "accueil";
  if (s.name === "play") return s.mode === "seance" ? "seance" : s.mode === "marathon" ? "marathon" : s.mode === "apprendre" ? "revision" : "entrainement";
  if (s.name === "daily") return "defi";
  if (s.name === "live" || s.name === "lobby" || s.name === "stage") return "multi";
  return "autre";
}

let last = "";
let lastAt = 0;
function send(force = false) {
  if (document.hidden || !navigator.onLine) return;
  const s = screen();
  if (!force && s === last && Date.now() - lastAt < 55_000) return;
  last = s; lastAt = Date.now();
  fetch("/api/stats/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, s }), keepalive: true }).catch(() => {});
}

export function startPresence() {
  send(true);
  setInterval(() => send(), 5_000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) send(true); });
}
