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

export function dep(code: string): Departement {
  const d = DEP.get(code);
  if (!d) throw new Error(`Département inconnu : ${code}`);
  return d;
}

/** "le Finistère", "l'Ain", "Paris" */
export function withArticle(d: Departement): string {
  if (!d.article) return d.nom;
  return d.article.endsWith("'") ? d.article + d.nom : `${d.article} ${d.nom}`;
}
