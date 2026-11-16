// Répétition espacée (boîtes de Leitner) par département.

export interface CardState {
  box: number;
  /** Timestamp (ms) à partir duquel le département redevient à revoir. */
  due: number;
  seen: number;
  correct: number;
}
export type Progress = Record<string, CardState>;

const MIN = 60_000, DAY = 86_400_000;
export const INTERVALS = [0, 10 * MIN, DAY, 3 * DAY, 7 * DAY, 21 * DAY, 60 * DAY];
export const MASTERED_BOX = 4;

export function review(state: CardState | undefined, accuracy: number, now: number): CardState {
  const s = state ?? { box: 0, due: 0, seen: 0, correct: 0 };
  const perfect = accuracy >= 0.999;
  let box = s.box;
  if (perfect) box = Math.min(box + 1, INTERVALS.length - 1);
  else if (accuracy < 0.5) box = 0;
  else box = Math.max(0, box - 1);
  return { box, due: now + INTERVALS[box], seen: s.seen + 1, correct: s.correct + (perfect ? 1 : 0) };
}

/**
 * Choisit les départements d'une session : d'abord ceux à revoir (les plus en retard),
 * puis des nouveaux, dans la limite de `newPerSession`.
 */
export function pickSession(progress: Progress, all: string[], n: number, now: number, newPerSession = 8): string[] {
  const seen = all.filter((c) => progress[c]);
  const due = seen.filter((c) => progress[c].due <= now).sort((a, b) => progress[a].box - progress[b].box || progress[a].due - progress[b].due);
  const fresh = all.filter((c) => !progress[c]);
  const out = [...due.slice(0, n)];
  out.push(...fresh.slice(0, Math.min(newPerSession, n - out.length)));
  if (out.length < n) {
    const soon = seen.filter((c) => !out.includes(c)).sort((a, b) => progress[a].due - progress[b].due);
    out.push(...soon.slice(0, n - out.length));
  }
  if (out.length < n) out.push(...fresh.filter((c) => !out.includes(c)).slice(0, n - out.length));
  return out;
}

export function mastery(progress: Progress, all: string[]): number {
  return all.filter((c) => (progress[c]?.box ?? 0) >= MASTERED_BOX).length;
}
