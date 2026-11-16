import type { GameConfig, GameMode, RoundResult, Question, Rewards } from "@hexa/game";

export type SoloMode = "apprendre" | "eclair" | "marathon" | "region";
export interface PlayScreen { name: "play"; config: GameConfig; title: string; learn: boolean; mode: GameMode; region?: string }
export type Screen =
  | { name: "home" }
  | { name: "tour"; region?: string }
  | { name: "training" }
  | { name: "setup"; mode: SoloMode }
  | PlayScreen
  | { name: "results"; play: PlayScreen; questions: Question[]; results: RoundResult[]; rewards: Rewards }
  | { name: "album"; tab?: "plaques" | "badges" }
  | { name: "atlas" }
  | { name: "account"; view?: "login" | "register" | "forgot" | "reset" | "verify" | "profile"; token?: string; then?: Screen }
  | { name: "daily" }
  | { name: "lobby"; join?: string }
  | { name: "live" }
  | { name: "stage"; code: string }
  | { name: "legal"; doc: "mentions" | "confidentialite" | "cgu" };

const SIMPLE: Partial<Record<Screen["name"], string>> = { tour: "#tour", training: "#entrainement", album: "#album", atlas: "#atlas", daily: "#defi" };
const LEGAL = { mentions: "#mentions-legales", confidentialite: "#confidentialite", cgu: "#cgu" };

class Nav {
  screen = $state<Screen>({ name: "home" });
  go(s: Screen) {
    this.screen = s;
    window.scrollTo(0, 0);
    // Liens partageables pour les écrans principaux, salons et pages légales.
    const hash = s.name === "lobby" && s.join ? `#salon=${s.join}` : s.name === "stage" ? `#plateau=${s.code}` : s.name === "legal" ? LEGAL[s.doc] : SIMPLE[s.name] ?? "";
    if (location.hash !== hash) history.replaceState(null, "", location.pathname + location.search + hash);
  }
}
export const nav = new Nav();

/** Écran de départ selon le lien ouvert. */
export function screenFromHash(): Screen {
  const h = location.hash;
  for (const [doc, v] of Object.entries(LEGAL)) if (h === v) return { name: "legal", doc: doc as keyof typeof LEGAL };
  for (const [name, v] of Object.entries(SIMPLE)) if (h === v) return { name } as Screen;
  const m = /^#([\w-]+)=([\w-]+)$/.exec(h);
  if (!m) return { name: "home" };
  const [, k, v] = m;
  if (k === "salon") return { name: "lobby", join: v.toUpperCase() };
  if (k === "plateau") return { name: "stage", code: v.toUpperCase() };
  if (k === "verifier") return { name: "account", view: "verify", token: v };
  if (k === "nouveau-mdp") return { name: "account", view: "reset", token: v };
  return { name: "home" };
}

/** Préférence de saisie (choix ou clavier), mémorisée entre les parties. */
export const inputPref = {
  get(): "choix" | "libre" | null { try { return localStorage.getItem("hexa.input") as "choix" | "libre" | null; } catch { return null; } },
  set(v: "choix" | "libre") { try { localStorage.setItem("hexa.input", v); } catch { /* rien */ } },
};
