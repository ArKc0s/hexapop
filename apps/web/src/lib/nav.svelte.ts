import type { GameConfig, RoundResult, Question } from "@hexa/game";

export type SoloMode = "apprendre" | "eclair" | "marathon" | "region";
export type Screen =
  | { name: "home" }
  | { name: "setup"; mode: SoloMode }
  | { name: "play"; config: GameConfig; title: string; learn: boolean }
  | { name: "results"; config: GameConfig; title: string; questions: Question[]; results: RoundResult[]; learn: boolean }
  | { name: "atlas" };

class Nav {
  screen = $state<Screen>({ name: "home" });
  go(s: Screen) { this.screen = s; window.scrollTo(0, 0); }
}
export const nav = new Nav();
