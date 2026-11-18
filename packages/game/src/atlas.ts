// Les atlas : un atlas = un monde (docs/atlas.md). Chaque atlas dit ce qu'on y apprend, sur quelles facettes,
// avec quels indices et quels intitulés, et comment ses éléments se regroupent pour les séances.
// Les codes sont uniques dans tout le jeu (régions préfixées « R »), donc la connaissance reste une seule fiche.
import { DEPARTEMENTS, REGION_ITEMS, WORLD_ITEMS, ITEM, R_METRO, R_OUTRE_MER, type Departement } from "./data.ts";
import type { Facet } from "./knowledge.ts";
import type { Field, Hint } from "./round.ts";

export type AtlasId = "france" | "regions" | "monde";
export interface Atlas {
  id: AtlasId;
  /** Nom court (sélecteur) et promesse en une phrase. */
  nom: string; promesse: string;
  /** « département » / « région », pour les phrases (« 3 départements à revoir »). */
  un: string; des: string; feminin: boolean;
  items: readonly Departement[];
  base: readonly Facet[]; expert: readonly Facet[];
  /** Indices possibles (Découverte : nom ou carte seulement, voir round.ts). */
  hints: readonly Hint[];
  /** Ce qu'une fiche complète demande. */
  full: readonly Field[];
  labels: Record<Field, string>;
  /** Questions du défi du jour. */
  dailyRounds: number;
  /** En essai : visible seulement en préprod, pas encore proposé aux joueurs. */
  preview?: boolean;
}

const LABELS_FR: Record<Field, string> = { carte: "Sur la carte", nom: "Nom", numero: "Numéro", prefecture: "Préfecture", sousPrefectures: "Sous-préfectures", limitrophes: "Voisins", drapeau: "Drapeau" };

export const ATLASES: Record<AtlasId, Atlas> = {
  france: {
    id: "france", nom: "Départements", promesse: "Les 101 départements par cœur", un: "département", des: "départements", feminin: false,
    items: DEPARTEMENTS, base: ["carte", "numero", "prefecture"], expert: ["sousPrefectures", "limitrophes"],
    hints: ["nom", "numero", "carte", "prefecture"], full: ["carte", "nom", "numero", "prefecture"], labels: LABELS_FR, dailyRounds: 10,
  },
  regions: {
    id: "regions", nom: "Régions", promesse: "Les 18 régions, leur chef-lieu et ce qu'elles contiennent", un: "région", des: "régions", feminin: true,
    items: REGION_ITEMS, base: ["carte", "prefecture"], expert: ["sousPrefectures", "limitrophes"],
    hints: ["nom", "carte", "prefecture"], full: ["carte", "nom", "prefecture"],
    labels: { ...LABELS_FR, prefecture: "Chef-lieu", sousPrefectures: "Ses départements", limitrophes: "Régions voisines" },
    dailyRounds: 5,
  },
  monde: {
    id: "monde", nom: "Monde", promesse: "Les 195 pays, leur capitale et leur drapeau", un: "pays", des: "pays", feminin: false,
    items: WORLD_ITEMS, base: ["carte", "drapeau", "prefecture"], expert: ["limitrophes"],
    hints: ["nom", "carte", "drapeau", "prefecture"], full: ["carte", "nom", "drapeau", "prefecture"],
    labels: { ...LABELS_FR, prefecture: "Capitale", limitrophes: "Pays voisins" },
    dailyRounds: 10, preview: true,
  },
};
export const ATLAS_IDS = Object.keys(ATLASES) as AtlasId[];
export const isAtlas = (v: unknown): v is AtlasId => typeof v === "string" && v in ATLASES;
/** Atlas d'un code (« R53 » : Régions ; « WFRA » : Monde ; sinon un département). */
export const atlasOf = (code: string): Atlas => (code.startsWith("R") ? ATLASES.regions : code.startsWith("W") ? ATLASES.monde : ATLASES.france);
/** Le code se lit tel quel (numéro de département) ; sinon on montre le nom seul. */
export const isDepartement = (code: string) => !code.startsWith("R") && !code.startsWith("W");
/** Atlas proposés aux joueurs : ceux en essai seulement en préprod. */
export const offeredAtlases = (preview: boolean): AtlasId[] => ATLAS_IDS.filter((a) => preview || !ATLASES[a].preview);
export const codesOf = (a: AtlasId) => ATLASES[a].items.map((d) => d.code);
export const inAtlas = (a: AtlasId, code: string) => ITEM.has(code) && atlasOf(code).id === a;
export { R_METRO, R_OUTRE_MER };

/** Code court affiché (vignettes, fiches) : le numéro d'un département, l'abréviation usuelle d'une région. */
const R_ABBR: Record<string, string> = {
  R01: "GUA", R02: "MTQ", R03: "GUY", R04: "RÉU", R06: "MAY", R11: "IDF", R24: "CVL", R27: "BFC", R28: "NOR", R32: "HDF",
  R44: "GES", R52: "PDL", R53: "BRE", R75: "NAQ", R76: "OCC", R84: "ARA", R93: "PACA", R94: "COR",
};
export const shortCode = (code: string) => R_ABBR[code] ?? (code.startsWith("W") ? code.slice(1) : code);
/** Drapeau d'un pays (fichiers de flag-icons, licence MIT, dans apps/web/public/drapeaux). */
export const flagUrl = (code: string) => { const d = ITEM.get(code); return d?.iso2 ? `/drapeaux/${d.iso2}.svg` : ""; };
