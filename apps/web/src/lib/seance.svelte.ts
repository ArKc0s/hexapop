// « Continuer » : compose la séance du jour à partir de ce que le joueur sait, et la lance.
import { composeSeance, DEFAULT_START, DEP, OUTRE_MER, randomSeed, type GameConfig, type InputMode, type Seance, type SeanceKind } from "@hexa/game";
import { nav } from "./nav.svelte.ts";
import { profile } from "./profile.svelte.ts";

/** Région de départ : celle du département d'origine du joueur. */
export function startRegion(): string {
  const home = profile.data.home ? DEP.get(profile.data.home) : null;
  return home ? (home.outreMer ? OUTRE_MER : home.region) : DEFAULT_START;
}

/** Aperçu de la prochaine séance (pour l'accueil), sans la lancer. */
export function previewSeance(kind?: SeanceKind): Seance {
  return composeSeance(profile.data.know ?? {}, { now: Date.now(), seed: 1, start: startRegion(), focus: profile.data.focus, home: profile.data.home, kind });
}

function answerMode(): InputMode {
  try { const m = localStorage.getItem("hexa.answerMode"); if (m === "choix" || m === "libre") return m; } catch { /* navigation privée */ }
  return "choix";
}

/** Titre annoncé = ce qu'on joue : une région, ou les révisions. */
export function seanceTitle(s: Seance): string {
  return s.kind === "revision" ? "Révisions · partout en France" : s.region ? `Séance · ${s.region.nom}` : "Séance";
}

export function startSeance(kind?: SeanceKind) {
  const seed = randomSeed();
  const s = composeSeance(profile.data.know ?? {}, { now: Date.now(), seed, start: startRegion(), focus: profile.data.focus, home: profile.data.home, kind });
  if (!s.plan.length) return nav.go({ name: "training" });
  const config: GameConfig = { seed, level: "normal", input: answerMode(), plan: s.plan, durationMs: 0, switchable: true };
  nav.go({ name: "play", mode: "seance", config, title: seanceTitle(s), learn: true });
}
