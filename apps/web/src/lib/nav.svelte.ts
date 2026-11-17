import type { GameConfig, GameMode, InputMode, RoundResult, Question, Rewards } from "@hexa/game";

export type AlbumTab = "medailles" | "carte" | "succes";
export interface PlayScreen { name: "play"; config: GameConfig; title: string; learn: boolean; mode: GameMode; region?: string }
export type Screen =
  | { name: "home" }
  | { name: "training" }
  | PlayScreen
  | { name: "results"; play: PlayScreen; questions: Question[]; results: RoundResult[]; rewards: Rewards; /** Réponses utilisées (Marathon : le Hall of Fame se joue au clavier). */ input?: InputMode }
  | { name: "hof" }
  | { name: "album"; tab?: AlbumTab }
  | { name: "account"; view?: "login" | "register" | "forgot" | "reset" | "verify" | "profile"; token?: string; then?: Screen; notice?: string; oauthError?: string }
  | { name: "daily" }
  | { name: "lobby"; join?: string }
  | { name: "live" }
  | { name: "stage"; code: string }
  | { name: "legal"; doc: "apropos" | "mentions" | "confidentialite" | "cgu" }
  | { name: "rappels" };

const SIMPLE: Partial<Record<Screen["name"], string>> = { training: "#entrainement", album: "#album", daily: "#defi", rappels: "#rappels", hof: "#hall-of-fame" };
const LEGAL = { apropos: "#a-propos", mentions: "#mentions-legales", confidentialite: "#confidentialite", cgu: "#cgu" };

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
  // L'Atlas fait partie de l'Album (onglet Carte) : les anciens liens y mènent.
  if (h === "#atlas") return { name: "album", tab: "carte" };
  const m = /^#([\w-]+)=([\w-]+)$/.exec(h);
  if (!m) return { name: "home" };
  const [, k, v] = m;
  if (k === "salon") return { name: "lobby", join: v.toUpperCase() };
  if (k === "plateau") return { name: "stage", code: v.toUpperCase() };
  if (k === "verifier") return { name: "account", view: "verify", token: v };
  if (k === "nouveau-mdp") return { name: "account", view: "reset", token: v };
  // Retour de connexion via Google, Discord, Twitch ou Apple
  if (k === "oauth-ok") {
    if (v.startsWith("lie-") && v !== "lie-auto") return { name: "account", view: "profile", notice: v };
    let back = "";
    try { back = sessionStorage.getItem("hexa.returnTo") ?? ""; sessionStorage.removeItem("hexa.returnTo"); } catch { /* rien */ }
    return back === "#defi" ? { name: "daily" } : { name: "home" };
  }
  if (k === "oauth-erreur") return { name: "account", view: "login", oauthError: v };
  return { name: "home" };
}

/** Préférence de saisie (choix ou clavier), mémorisée entre les parties. */
export const inputPref = {
  get(): "choix" | "libre" | null { try { return localStorage.getItem("hexa.input") as "choix" | "libre" | null; } catch { return null; } },
  set(v: "choix" | "libre") { try { localStorage.setItem("hexa.input", v); } catch { /* rien */ } },
};
