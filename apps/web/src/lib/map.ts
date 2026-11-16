import map from "@hexa/data/map.json";
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
const TINTS = ["var(--tint-a)", "var(--tint-b)", "var(--tint-c)", "var(--paper)"];
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
