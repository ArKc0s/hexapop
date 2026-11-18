import map from "@hexa/data/map.json";
import { mondeCarte } from "./world.svelte.ts";
import { DEPARTEMENTS } from "@hexa/game";

export interface Box { x: number; y: number; w: number; h: number }
export const MAP = map as unknown as {
  viewBox: [number, number, number, number];
  insets: (Box & { code: string })[];
  zooms: (Box & { id: string; codes: string[] })[];
  labels: Record<string, [number, number]>;
  paths: Record<string, string>;
};

/** Encart agrandi Paris + petite couronne, placé dans le vide au nord-est. */
export const IDF_TARGET: Box = { x: 820, y: 0, w: 165, h: 150 };
export const IDF_SOURCE = MAP.zooms.find((z) => z.id === "idf")!;
export function zoomTransform(src: Box, dst: Box): string {
  const pad = 10;
  const s = Math.min((dst.w - pad * 2) / src.w, (dst.h - pad * 2) / src.h);
  const tx = dst.x + (dst.w - src.w * s) / 2 - src.x * s;
  const ty = dst.y + (dst.h - src.h * s) / 2 - src.y * s;
  return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(3)})`;
}

/** Teintes de région : coloration gloutonne pour que deux régions voisines diffèrent. */
const TINTS = ["var(--tint-a)", "var(--tint-b)", "var(--tint-c)", "var(--bg)"];
function regionTints(): Record<string, string> {
  const adj = new Map<string, Set<string>>();
  for (const d of DEPARTEMENTS) {
    if (!adj.has(d.region)) adj.set(d.region, new Set());
    for (const n of d.limitrophes) {
      const r = DEPARTEMENTS.find((x) => x.code === n)!.region;
      if (r !== d.region) adj.get(d.region)!.add(r);
    }
  }
  const order = [...adj.keys()].sort((a, b) => adj.get(b)!.size - adj.get(a)!.size);
  const color = new Map<string, number>();
  for (const r of order) {
    const used = new Set([...adj.get(r)!].map((x) => color.get(x)));
    let c = 0;
    while (used.has(c)) c++;
    color.set(r, c);
  }
  return Object.fromEntries(DEPARTEMENTS.map((d) => [d.code, TINTS[(color.get(d.region) ?? 0) % TINTS.length]]));
}
export const TINT_BY_DEP = regionTints();

// ---------- géométrie par atlas (docs/atlas.md) ----------
import type { AtlasId } from "@hexa/game";
export interface Geo {
  atlas: AtlasId;
  /** Une forme par élément cliquable (département, région…). */
  paths: Record<string, string>;
  insets: (Box & { code: string })[];
  /** Encart agrandi (Paris et petite couronne) : départements seulement. */
  zoom: boolean;
  /** Contours épais par-dessus (les régions, sur la carte des départements). */
  outlines: string[];
  /** Traits fins en filigrane (les départements, sur la carte des régions). */
  inner: string[];
  /** Cadre de la carte (défaut : celui de la France, avec l'outre-mer en bandeau sur mobile). */
  viewBox?: [number, number, number, number];
  /** Terres qui ne se jouent pas (Monde : Groenland, Sahara occidental, territoires…), en fond. */
  fond?: string;
  /** Monde : les pays trop petits pour le doigt ont un rond cliquable (centre). */
  dots?: Record<string, [number, number]>;
  /** Monde : cadre de chaque continent (code du groupe → x, y, largeur, hauteur). */
  views?: Record<string, [number, number, number, number]>;
}
type MondeCarte = { viewBox: [number, number, number, number]; paths: Record<string, string>; dots: Record<string, [number, number]>; fond: string; cote: string; views: Record<string, [number, number, number, number]> };
/** Un rond ajouté au tracé d'un petit pays, de rayon r (en unités de la carte : Map.svelte le garde constant à l'écran).
 *  En polygone et en coordonnées absolues, pour que les calculs de cadre lisent des points de la carte. */
export const circle = ([x, y]: [number, number], r: number) =>
  "M" + Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return `${(x + r * Math.cos(a)).toFixed(2)},${(y + r * Math.sin(a)).toFixed(2)}`; }).join("L") + "Z";
let mondeGeo: Geo | null = null;
const EMPTY_MONDE: Geo = { atlas: "monde", paths: {}, insets: [], zoom: false, outlines: [], inner: [], viewBox: [0, 0, 1000, 450], views: {} };
function monde(): Geo {
  const W = mondeCarte.data as MondeCarte | null; // lu ici : la carte se redessine quand le fichier arrive
  if (!W) return EMPTY_MONDE;
  return (mondeGeo ??= { atlas: "monde", paths: W.paths, insets: [], zoom: false, outlines: [W.cote], inner: [], viewBox: W.viewBox, fond: W.fond, dots: W.dots, views: W.views });
}
const REGIONS_OUTLINE = (map as unknown as { regions: Record<string, string> }).regions;
/** Outre-mer : une région = un département, même encart. */
const OM_REGION: Record<string, string> = { "971": "R01", "972": "R02", "973": "R03", "974": "R04", "976": "R06" };
const GEO: Record<"france" | "regions", Geo> = {
  france: { atlas: "france", paths: MAP.paths, insets: MAP.insets, zoom: true, outlines: Object.values(REGIONS_OUTLINE), inner: [] },
  regions: {
    atlas: "regions",
    paths: {
      ...Object.fromEntries(Object.entries(REGIONS_OUTLINE).map(([c, d]) => ["R" + c, d])),
      ...Object.fromEntries(Object.entries(OM_REGION).map(([dep, r]) => [r, MAP.paths[dep]])),
    },
    insets: MAP.insets.map((b) => ({ ...b, code: OM_REGION[b.code] ?? b.code })),
    zoom: false, outlines: [],
    inner: DEPARTEMENTS.filter((d) => !d.outreMer).map((d) => MAP.paths[d.code]),
  },
};
export const geoOf = (a: AtlasId): Geo => (a === "monde" ? monde() : GEO[a as "france" | "regions"]);
