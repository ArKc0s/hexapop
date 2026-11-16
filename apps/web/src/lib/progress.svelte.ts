import { review, type Progress, type RoundResult } from "@hexa/game";

const KEY = "hexa.progress.v1";

function load(): Progress {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}
function save(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* stockage indisponible */ }
}

class ProgressStore {
  data = $state<Progress>(load());
  private listeners: (() => void)[] = [];

  onChange(fn: () => void) { this.listeners.push(fn); }

  record(results: RoundResult[]) {
    const now = Date.now();
    const next = { ...this.data };
    for (const r of results) next[r.code] = review(next[r.code], r.accuracy, now);
    this.data = next;
    save(next);
    for (const fn of this.listeners) fn();
  }

  /** Remplace par la version fusionnée du serveur (sans relancer de synchro). */
  replace(p: Progress) {
    this.data = p;
    save(p);
  }
}
export const progress = new ProgressStore();
