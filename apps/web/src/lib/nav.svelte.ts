import type { GameConfig, RoundResult, Question } from "@hexa/game";

export type SoloMode = "apprendre" | "eclair" | "marathon" | "region";
export type Screen =
  | { name: "home" }
  | { name: "setup"; mode: SoloMode }
  | { name: "play"; config: GameConfig; title: string; learn: boolean }
  | { name: "results"; config: GameConfig; title: string; questions: Question[]; results: RoundResult[]; learn: boolean }
  | { name: "atlas" }
  | { name: "account"; view?: "login" | "register" | "forgot" | "reset" | "verify" | "profile"; token?: string; then?: Screen }
  | { name: "daily" }
  | { name: "lobby"; join?: string }
  | { name: "live" }
  | { name: "stage"; code: string }
  | { name: "legal"; doc: "mentions" | "confidentialite" | "cgu" };

class Nav {
  screen = $state<Screen>({ name: "home" });
  go(s: Screen) {
    this.screen = s;
    window.scrollTo(0, 0);
    // Garde un lien partageable pour les salons, nettoie le reste.
    const LEGAL = { mentions: "#mentions-legales", confidentialite: "#confidentialite", cgu: "#cgu" };
    const hash = s.name === "lobby" && s.join ? `#salon=${s.join}` : s.name === "stage" ? `#plateau=${s.code}` : s.name === "legal" ? LEGAL[s.doc] : "";
    if (location.hash !== hash) history.replaceState(null, "", location.pathname + location.search + hash);
  }
}
export const nav = new Nav();

/** Écran de départ selon le lien ouvert (#salon=ABCD, #plateau=ABCD, #verifier=…, #nouveau-mdp=…). */
export function screenFromHash(): Screen {
  if (location.hash === "#mentions-legales") return { name: "legal", doc: "mentions" };
  if (location.hash === "#confidentialite") return { name: "legal", doc: "confidentialite" };
  if (location.hash === "#cgu") return { name: "legal", doc: "cgu" };
  const m = /^#([\w-]+)=([\w-]+)$/.exec(location.hash);
  if (!m) return { name: "home" };
  const [, k, v] = m;
  if (k === "salon") return { name: "lobby", join: v.toUpperCase() };
  if (k === "plateau") return { name: "stage", code: v.toUpperCase() };
  if (k === "verifier") return { name: "account", view: "verify", token: v };
  if (k === "nouveau-mdp") return { name: "account", view: "reset", token: v };
  return { name: "home" };
}
