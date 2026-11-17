import deps from "@hexa/data/departements.json" with { type: "json" };
import regs from "@hexa/data/regions.json" with { type: "json" };

export interface Departement {
  code: string;
  nom: string;
  article: string;
  region: string;
  prefecture: string;
  sousPrefectures: string[];
  outreMer: boolean;
  limitrophes: string[];
}
export interface Region { code: string; nom: string; chefLieu: string }

export const DEPARTEMENTS: readonly Departement[] = deps as Departement[];
export const REGIONS: readonly Region[] = regs as Region[];
export const DEP = new Map(DEPARTEMENTS.map((d) => [d.code, d]));
export const REGION = new Map(REGIONS.map((r) => [r.code, r]));

// ---------- Atlas Régions : chaque région, au même format qu'un département (voir atlas.ts et docs/atlas.md) ----------
// Codes préfixés (« R53 » = Bretagne) : une région ne se mélange jamais avec un département (la région 11 n'est pas l'Aude).
const R_ARTICLE: Record<string, string> = {
  "01": "la", "02": "la", "03": "la", "04": "", "06": "", "11": "l'", "24": "le", "27": "la", "28": "la", "32": "les", "44": "le",
  "52": "les", "53": "la", "75": "la", "76": "l'", "84": "l'", "93": "la", "94": "la",
};
/** Groupe d'une région pour les séances : métropole ou outre-mer. */
export const R_METRO = "RM", R_OUTRE_MER = "RO";
export const REGION_ITEMS: readonly Departement[] = REGIONS.map((r) => {
  const deps = DEPARTEMENTS.filter((d) => d.region === r.code);
  const om = deps.every((d) => d.outreMer);
  const near = new Set<string>();
  for (const d of deps) for (const n of d.limitrophes) { const nr = DEP.get(n)!.region; if (nr !== r.code) near.add("R" + nr); }
  return {
    code: "R" + r.code, nom: r.nom, article: R_ARTICLE[r.code] ?? "", region: om ? R_OUTRE_MER : R_METRO,
    prefecture: r.chefLieu,
    // Expert « ses départements » : seulement quand il y en a plusieurs (une région d'outre-mer = un département).
    sousPrefectures: deps.length > 1 ? deps.map((d) => d.nom) : [],
    outreMer: om, limitrophes: [...near].sort(),
  };
});
/** Tout ce qui s'apprend, tous atlas confondus (départements et régions), par code. */
export const ITEM = new Map<string, Departement>([...DEPARTEMENTS, ...REGION_ITEMS].map((d) => [d.code, d]));

/** Un département ou, pour les autres atlas, la chose à apprendre de ce code (même forme). */
export function dep(code: string): Departement {
  const d = ITEM.get(code);
  if (!d) throw new Error(`Élément inconnu : ${code}`);
  return d;
}

/** "le Finistère", "l'Ain", "Paris" */
export function withArticle(d: Departement): string {
  if (!d.article) return d.nom;
  return d.article.endsWith("'") ? d.article + d.nom : `${d.article} ${d.nom}`;
}
