import { mount } from "svelte";
// Polices auto-hébergées (aucune requête vers Google : pas de transfert d'IP à un tiers).
import "@fontsource/bowlby-one/latin-400.css";
import "@fontsource/gabarito/latin-500.css";
import "@fontsource/gabarito/latin-600.css";
import "@fontsource/gabarito/latin-700.css";
import "@fontsource/gabarito/latin-800.css";
import "@fontsource/gabarito/latin-900.css";
import "./lib/theme.css";
import App from "./App.svelte";

mount(App, { target: document.getElementById("app")! });

// Jeu jouable hors ligne : le service worker garde une copie de l'appli (voir public/sw.js).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}

// Statistiques anonymes (visiteurs uniques du jour, sans cookie : voir la page Confidentialité).
if (import.meta.env.PROD) {
  const app = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  fetch("/api/stats/event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ e: "visite", app }), keepalive: true }).catch(() => {});
}
