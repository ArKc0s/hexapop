<script lang="ts">
  // Aperçu vivant d'un atlas (écran de bienvenue) : la carte se remplit comme pendant une vraie partie.
  // Un élément clignote en jaune (la question), passe au vert (trouvé), puis prend une couleur de « Ta France »
  // (étoiles, médailles). Au bout d'un moment, on repart de zéro. Sans animation si le joueur l'a demandé.
  import { onDestroy } from "svelte";
  import { ATLASES, type AtlasId } from "@hexa/game";
  import Map, { type Mark } from "../Map.svelte";
  import { MEDAL_FILL, STAR_FILL } from "../knowFills.ts";
  import { geoOf } from "../map.ts";

  let { atlas, delay = 0 }: { atlas: AtlasId; delay?: number } = $props();

  // Pas d'or : il se confondrait avec le jaune de la question qui clignote.
  const PALETTE = [STAR_FILL[1], STAR_FILL[2], STAR_FILL[2], MEDAL_FILL[1], MEDAL_FILL[2]];
  // Seulement ce qui se voit en petit : ni l'outre-mer, ni les micro-États du Monde (des ronds).
  // (la carte du monde arrive après coup : on relit les petits pays à chaque fois)
  const codesNow = () => { const dots = geoOf(atlas).dots ?? {}; return ATLASES[atlas].items.filter((d) => !d.outreMer && !dots[d.code]).map((d) => d.code); };
  let codes = codesNow();
  const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

  /** Point de départ : un tiers de la carte déjà coloré, pour qu'on voie tout de suite à quoi ça ressemble. */
  function seed(): Record<string, string> {
    const f: Record<string, string> = {};
    for (const c of codes) if (Math.random() < (atlas === "monde" ? 0.45 : 0.3)) f[c] = pick(PALETTE);
    return f;
  }
  let fills = $state<Record<string, string>>(seed());
  let marks = $state<Record<string, Mark>>({});

  const still = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, f: () => void) => timers.push(setTimeout(f, ms));
  function step() {
    codes = codesNow();
    const left = codes.filter((c) => !fills[c]);
    if (left.length < codes.length * 0.25) { fills = seed(); later(600, step); return; }
    const c = pick(left);
    marks = { [c]: "hint" };
    later(1300, () => {
      marks = { [c]: "ok" };
      later(800, () => { fills = { ...fills, [c]: pick(PALETTE) }; marks = {}; later(400, step); });
    });
  }
  if (!still) later(700 + delay, step);
  onDestroy(() => timers.forEach(clearTimeout));
</script>

<div class="preview"><Map {atlas} {fills} {marks} interactive={false} label="Aperçu : {ATLASES[atlas].nom}" /></div>

<style>
  .preview { pointer-events: none; }
</style>
