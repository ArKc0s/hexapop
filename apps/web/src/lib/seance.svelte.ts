// « Continuer » : compose la séance du jour à partir de ce que le joueur sait, et la lance.
import { composeSeance, DEFAULT_START, DEP, OUTRE_MER, randomSeed, type GameConfig, type InputMode, type Seance, type SeanceKind } from "@hexa/game";
import { nav } from "./nav.svelte.ts";
import { profile } from "./profile.svelte.ts";
import { world } from "./world.svelte.ts";

/** Région de départ : celle du département d'origine du joueur. */
export function startRegion(): string {
  const home = profile.data.home ? DEP.get(profile.data.home) : null;
  return home ? (home.outreMer ? OUTRE_MER : home.region) : DEFAULT_START;
}

/** Aperçu de la prochaine séance (pour l'accueil), sans la lancer. */
export function previewSeance(kind?: SeanceKind): Seance {
  return composeSeance(profile.data.know ?? {}, { now: Date.now(), seed: 1, start: startRegion(), focus: profile.data.focus, home: profile.data.home, kind, atlas: world.id });
}

function answerMode(): InputMode {
  try { const m = localStorage.getItem("hexa.answerMode"); if (m === "choix" || m === "libre") return m; } catch { /* navigation privée */ }
  return "choix";
}

/** Titre annoncé = ce qu'on joue : une région, ou les révisions. */
export function seanceTitle(s: Seance): string {
  if (s.kind === "revision") return world.id === "france" ? "Révisions · partout en France" : `Révisions · ${world.atlas.nom}`;
  if (!s.region) return "Séance";
  // Atlas Régions : « Régions · Métropole ».
  const where = world.id === "france" ? s.region.nom : `${world.atlas.nom} · ${s.region.nom}`;
  return `${s.expert ? "Expert" : "Séance"} · ${where}`;
}

export function startSeance(kind?: SeanceKind) {
  const seed = randomSeed();
  const s = composeSeance(profile.data.know ?? {}, { now: Date.now(), seed, start: startRegion(), focus: profile.data.focus, home: profile.data.home, kind, atlas: world.id });
  if (!s.plan.length) return nav.go({ name: "training" });
  const config: GameConfig = { seed, atlas: world.id, level: "normal", input: answerMode(), plan: s.plan, durationMs: 0, switchable: true };
  nav.go({ name: "play", mode: "seance", config, title: seanceTitle(s), learn: true });
}
