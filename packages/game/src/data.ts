import deps from "@hexa/data/departements.json" with { type: "json" };
import regs from "@hexa/data/regions.json" with { type: "json" };
import monde from "@hexa/data/monde.json" with { type: "json" };

export interface Departement {
  code: string;
  nom: string;
  article: string;
  region: string;
  prefecture: string;
  sousPrefectures: string[];
  outreMer: boolean;
  limitrophes: string[];
  /** Autres noms acceptés (« RDC », « Myanmar »). */
  alias?: string[];
  /** Autres réponses acceptées pour la préfecture / capitale (« La Paz » pour la Bolivie). */
  prefAlias?: string[];
  /** Pays : code ISO à deux lettres, pour son drapeau. */
  iso2?: string;
  /** Pays : notoriété (petit = connu de tous), pour découvrir la France avant le Vatican. */
  rang?: number;
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
// ---------- Atlas Monde : les 195 pays (data/scripts/build-monde.mjs), codes préfixés « W » (WFRA = France) ----------
/** Continents : les groupes de séance du Monde. */
export const CONTINENTS: readonly { code: string; nom: string }[] = [
  { code: "WEU", nom: "Europe" }, { code: "WAF", nom: "Afrique" }, { code: "WAS", nom: "Asie" },
  { code: "WNA", nom: "Amérique du Nord et centrale" }, { code: "WSA", nom: "Amérique du Sud" }, { code: "WOC", nom: "Océanie" },
];
interface Pays { code: string; iso2: string; rang: number; nom: string; article: string; capitale: string; continent: string; limitrophes: string[]; alias?: string[]; capAlias?: string[] }
export const WORLD_ITEMS: readonly Departement[] = (monde.items as Pays[]).map((p) => ({
  code: p.code, nom: p.nom, article: p.article, region: "W" + p.continent, prefecture: p.capitale, sousPrefectures: [],
  outreMer: false, limitrophes: p.limitrophes, iso2: p.iso2, rang: p.rang,
  ...(p.alias ? { alias: p.alias } : {}), ...(p.capAlias ? { prefAlias: p.capAlias } : {}),
}));

/** Tout ce qui s'apprend, tous atlas confondus (départements, régions, pays), par code. */
export const ITEM = new Map<string, Departement>([...DEPARTEMENTS, ...REGION_ITEMS, ...WORLD_ITEMS].map((d) => [d.code, d]));

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
