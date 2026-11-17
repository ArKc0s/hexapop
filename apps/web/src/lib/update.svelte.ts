// Mises à jour de l'appli ouverte : une appli installée reste en mémoire des heures sans jamais recharger sa page.
// On relit /version.json au retour au premier plan et toutes les 5 minutes. Si une nouvelle version est en ligne :
// - de retour sur l'appli et à l'accueil (aucune partie en cours) : rechargement immédiat, invisible ;
// - sinon : un bandeau « Nouvelle version » propose de mettre à jour quand on veut (jamais pendant une partie).
import { BUILT } from "./version.ts";
import { nav } from "./nav.svelte.ts";

const GAME_SCREENS = new Set(["play", "live", "stage", "daily", "lobby"]);

class Updater {
  available = $state(false);
  private checking = false;

  async check(): Promise<boolean> {
    if (this.checking || this.available) return this.available;
    this.checking = true;
    try {
      const r = await fetch("/version.json", { cache: "no-store" });
      if (r.ok) {
        const v = (await r.json()) as { built?: string };
        // Plus récente que la nôtre : une mise à jour est en ligne (la date de compilation change à chaque version).
        if (v.built && new Date(v.built).getTime() > BUILT.getTime()) this.available = true;
      }
    } catch { /* hors ligne */ }
    this.checking = false;
    return this.available;
  }

  /** Moment sans risque pour recharger : pas d'écran de partie. */
  get safe() { return !GAME_SCREENS.has(nav.screen.name); }

  apply() { location.reload(); }

  start() {
    if (!import.meta.env.PROD) return;
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible") return;
      if ((await this.check()) && nav.screen.name === "home") this.apply();
    });
    addEventListener("online", () => void this.check());
    setInterval(() => void this.check(), 5 * 60_000);
    setTimeout(() => void this.check(), 10_000);
  }
}
export const updater = new Updater();
