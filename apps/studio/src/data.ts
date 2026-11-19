// Données du jeu (départements, régions) et petites tournures de français pour les textes lus.
import deps from "../../../packages/data/src/departements.json" with { type: "json" };
import regs from "../../../packages/data/src/regions.json" with { type: "json" };

export interface Dep { code: string; nom: string; article: string; region: string; prefecture: string; sousPrefectures: string[]; outreMer: boolean; limitrophes: string[] }
export interface Region { code: string; nom: string }

export const DEPS = deps as Dep[];
export const REGIONS = regs as Region[];
const BY = new Map(DEPS.map((d) => [d.code, d]));
export const dep = (code: string): Dep => { const d = BY.get(code); if (!d) throw new Error("département inconnu : " + code); return d; };
/** La métropole (la carte des reels ne montre qu'elle). */
export const METRO = DEPS.filter((d) => !d.outreMer);
/** Trop petits pour se voir sur la carte entière : Paris et la petite couronne. */
export const TINY = new Set(["75", "92", "93", "94"]);

// Le jeu écrit « Saône-et-Loire » sans article ; à l'oral on dit « la Saône-et-Loire ».
const SPOKEN: Record<string, string> = { "28": "l'", "35": "l'", "37": "l'", "49": "le", "54": "la", "71": "la", "77": "la" };
const art = (d: Dep) => SPOKEN[d.code] ?? d.article;
/** « la Lozère », « l'Ain », « les Landes », « Paris ». */
export function le(d: Dep): string { const a = art(d); return !a ? d.nom : a.endsWith("'") ? a + d.nom : `${a} ${d.nom}`; }
/** « de la Lozère », « de l'Ain », « des Landes », « du Gers », « de Paris ». */
export function de(d: Dep): string { const a = art(d); return a === "le" ? "du " + d.nom : a === "les" ? "des " + d.nom : "de " + le(d); }
export const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Régions de métropole : « en Occitanie » / « d'Occitanie ». */
export const REGION_FR: Record<string, { en: string; de: string }> = {
  "84": { en: "en Auvergne-Rhône-Alpes", de: "d'Auvergne-Rhône-Alpes" },
  "27": { en: "en Bourgogne-Franche-Comté", de: "de Bourgogne-Franche-Comté" },
  "53": { en: "en Bretagne", de: "de Bretagne" },
  "24": { en: "en Centre-Val de Loire", de: "du Centre-Val de Loire" },
  "94": { en: "en Corse", de: "de Corse" },
  "44": { en: "dans le Grand Est", de: "du Grand Est" },
  "32": { en: "dans les Hauts-de-France", de: "des Hauts-de-France" },
  "11": { en: "en Île-de-France", de: "d'Île-de-France" },
  "28": { en: "en Normandie", de: "de Normandie" },
  "75": { en: "en Nouvelle-Aquitaine", de: "de Nouvelle-Aquitaine" },
  "76": { en: "en Occitanie", de: "d'Occitanie" },
  "52": { en: "dans les Pays de la Loire", de: "des Pays de la Loire" },
  "93": { en: "en Provence-Alpes-Côte d'Azur", de: "de Provence-Alpes-Côte d'Azur" },
};
export const regionName = (code: string) => REGIONS.find((r) => r.code === code)?.nom ?? code;

/**
 * Sous-préfectures connues, plus grandes ou plus célèbres que la préfecture : les meilleurs pièges.
 * Chacune est revérifiée contre les données au chargement (une entrée fausse est simplement ignorée).
 */
const PIEGES_BRUTS: [string, string][] = [
  ["12", "Millau"], ["51", "Reims"], ["76", "Le Havre"], ["29", "Brest"], ["62", "Calais"], ["62", "Lens"], ["62", "Boulogne-sur-Mer"],
  ["59", "Dunkerque"], ["59", "Valenciennes"], ["59", "Douai"], ["13", "Aix-en-Provence"], ["13", "Arles"], ["64", "Bayonne"], ["71", "Chalon-sur-Saône"],
  ["68", "Mulhouse"], ["44", "Saint-Nazaire"], ["56", "Lorient"], ["34", "Béziers"], ["11", "Narbonne"], ["35", "Saint-Malo"], ["06", "Grasse"],
  ["42", "Roanne"], ["02", "Saint-Quentin"], ["57", "Thionville"], ["38", "Vienne"], ["69", "Villefranche-sur-Saône"], ["24", "Bergerac"],
  ["24", "Sarlat-la-Canéda"], ["80", "Abbeville"], ["03", "Montluçon"], ["03", "Vichy"], ["52", "Saint-Dizier"], ["51", "Épernay"],
  ["16", "Cognac"], ["50", "Cherbourg-en-Cotentin"], ["25", "Montbéliard"], ["17", "Rochefort"], ["17", "Saintes"], ["40", "Dax"], ["76", "Dieppe"],
];
export const PIEGES = PIEGES_BRUTS.filter(([c, v]) => BY.get(c)?.sousPrefectures.includes(v));
