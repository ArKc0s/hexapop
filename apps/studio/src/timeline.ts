// Ligne de temps d'un reel : les phrases lues (dont la durée vient de la voix) font avancer le temps,
// et chaque format y pose ses éléments visuels (voir page/reel.html pour leur dessin).

export interface Word { w: string; t: number }
export interface Spoken { dur: number; words: Word[] }
/** Une phrase à faire lire, avec ses indications de jeu ElevenLabs v3 (« [excited] … »). */
export interface Line { id: string; text: string }
export type El = Record<string, unknown> & { k: string; t0: number; t1?: number };
export interface Said { t0: number; t1: number; words: Word[] }

const BEAT = 0.5;
/** Le texte vraiment prononcé (sans les indications entre crochets). */
export const spokenText = (text: string) => text.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();

export class Timeline {
  t = 0.3;
  els: El[] = [];
  dings: number[] = [];
  voice: { line: Line; t: number }[] = [];
  private n = 0;
  private lookup: (text: string) => Spoken;
  constructor(lookup: (text: string) => Spoken) { this.lookup = lookup; }

  /** Fait lire une phrase à partir de maintenant ; le temps avance de sa durée (+ une respiration). */
  say(text: string, opts: { pad?: number; min?: number } = {}): Said {
    const sp = this.lookup(text), t0 = this.t;
    this.voice.push({ line: { id: `l${this.n++}`, text }, t: t0 });
    const t1 = t0 + Math.max(opts.min ?? 0, sp.dur + (opts.pad ?? 0.3));
    this.t = t1;
    return { t0, t1, words: sp.words.map((w) => ({ w: w.w, t: t0 + w.t })) };
  }
  wait(sec: number): { t0: number; t1: number } { const t0 = this.t; this.t += sec; return { t0, t1: this.t }; }
  /** Recale le temps sur le prochain temps de la musique (les coupes tombent sur le rythme). */
  beat(): number { this.t = Math.ceil(this.t / BEAT - 1e-6) * BEAT; return this.t; }
  add(el: El): El { this.els.push(el); return el; }
}

/** Mots affichés : en capitales, « hexapop point app » redevient « HEXAPOP.APP ». */
function shown(words: Word[]): Word[] {
  const out: Word[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].w;
    if (/^hexapop$/i.test(w) && /^point$/i.test(words[i + 1]?.w ?? "") && /^app/i.test(words[i + 2]?.w ?? "")) {
      out.push({ w: "HEXAPOP.APP" + words[i + 2].w.slice(3), t: words[i].t }); i += 2; continue;
    }
    out.push({ w: w.toLocaleUpperCase("fr-FR").replace(/[.,;:]+$/, ""), t: words[i].t }); // pas de point ni de virgule en fin de sous-titre
  }
  return out;
}

/**
 * Sous-titres de reel : les mots regroupés en lignes courtes, chaque ligne « pop » quand son premier mot
 * est prononcé. `yellow` : les lignes qui contiennent l'un de ces mots passent en jaune.
 */
export function rows(tl: Timeline, said: Said, o: { y: number; size?: number; max?: number; gap?: number; yellow?: string[]; t1?: number; from?: number; to?: number; end?: string }): El[] {
  const words = shown(said.words.slice(o.from ?? 0, o.to));
  if (o.end && words.length) words[words.length - 1] = { ...words[words.length - 1], w: words[words.length - 1].w + o.end };
  const max = o.max ?? 14, size = o.size ?? 104, gap = o.gap ?? size * 1.22;
  const lines: Word[][] = [];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur && [...cur, w].map((x) => x.w).join(" ").length <= max) cur.push(w); else lines.push([w]);
  }
  const hot = (o.yellow ?? []).map((s) => s.toLocaleUpperCase("fr-FR"));
  return lines.map((ln, i) => {
    const text = ln.map((x) => x.w).join(" ");
    return tl.add({ k: "cap", t0: ln[0].t, t1: o.t1, text, y: o.y + i * gap, size, color: hot.some((h) => text.includes(h)) ? "yellow" : "#fff" });
  });
}

/** Instant où un mot (début) est prononcé, ou le début de la phrase. */
export function at(said: Said, word: string): number {
  const norm = (s: string) => s.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9']/g, "");
  return said.words.find((w) => norm(w.w).startsWith(norm(word)))?.t ?? said.t0;
}

/** Durée estimée (premier passage, avant d'avoir les vraies voix) : sert à connaître les phrases à faire lire. */
export function estimate(text: string): Spoken {
  const words = spokenText(text).split(" ");
  let t = 0.1; return { dur: 0.2 + spokenText(text).length * 0.065, words: words.map((w) => { const x = { w, t }; t += 0.065 * (w.length + 1); return x; }) };
}
