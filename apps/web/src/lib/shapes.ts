import { MAP } from "./map.ts";

/** Silhouette d'un département : son tracé et une viewBox cadrée dessus (avec marge). */
const cache = new Map<string, { d: string; viewBox: string }>();
export function depShape(code: string) {
  const hit = cache.get(code);
  if (hit) return hit;
  const d = MAP.paths[code];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [, x, y] of d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) {
    x0 = Math.min(x0, +x); x1 = Math.max(x1, +x); y0 = Math.min(y0, +y); y1 = Math.max(y1, +y);
  }
  const w = x1 - x0, h = y1 - y0, s = Math.max(w, h), pad = s * 0.12;
  // Cadre carré centré sur la forme, pour que toutes les vignettes aient la même échelle visuelle.
  const cx = x0 + w / 2, cy = y0 + h / 2, half = s / 2 + pad;
  const shape = { d, viewBox: `${(cx - half).toFixed(1)} ${(cy - half).toFixed(1)} ${(2 * half).toFixed(1)} ${(2 * half).toFixed(1)}` };
  cache.set(code, shape);
  return shape;
}
