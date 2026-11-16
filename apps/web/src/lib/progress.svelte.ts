import { review, type Progress, type RoundResult } from "@hexa/game";

const KEY = "hexa.progress.v1";

function load(): Progress {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}

class ProgressStore {
  data = $state<Progress>(load());

  record(results: RoundResult[]) {
    const now = Date.now();
    const next = { ...this.data };
    for (const r of results) next[r.code] = review(next[r.code], r.accuracy, now);
    this.data = next;
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
  }
}
export const progress = new ProgressStore();
