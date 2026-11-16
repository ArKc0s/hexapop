// Comparaison tolérante des réponses saisies au clavier.

const ARTICLES = /^(le|la|les|l|aux|du|de la|des|d)\s+/;

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[-'’`´.]/g, " ")
    .replace(/\bsainte\b/g, "ste")
    .replace(/\bsaint\b/g, "st")
    .replace(/\s+/g, " ")
    .trim()
    .replace(ARTICLES, "");
}

/** Distance de Damerau-Levenshtein (transpositions adjacentes comprises). */
export function distance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[m][n];
}

/** Fautes de frappe tolérées selon la longueur du mot attendu. */
function tolerance(len: number): number {
  if (len < 5) return 0;
  if (len < 10) return 1;
  return 2;
}

export function sameName(input: string, expected: string): boolean {
  const a = normalize(input), b = normalize(expected);
  if (!a) return false;
  if (a === b) return true;
  return distance(a, b) <= tolerance(b.length);
}

export function normalizeCode(s: string): string {
  const t = s.trim().toUpperCase().replace(/\s+/g, "");
  if (/^\d$/.test(t)) return "0" + t;
  return t;
}

export function sameCode(input: string, expected: string): boolean {
  return normalizeCode(input) === expected;
}

/**
 * Note une liste de noms saisis contre une liste attendue (ordre libre).
 * Renvoie les attendus trouvés et les saisies qui ne correspondent à rien.
 */
export function matchSet(inputs: string[], expected: string[]): { found: string[]; wrong: string[] } {
  const left = [...expected];
  const found: string[] = [], wrong: string[] = [];
  for (const raw of inputs) {
    if (!normalize(raw)) continue;
    const i = left.findIndex((e) => sameName(raw, e));
    if (i >= 0) found.push(...left.splice(i, 1));
    else wrong.push(raw);
  }
  return { found, wrong };
}
