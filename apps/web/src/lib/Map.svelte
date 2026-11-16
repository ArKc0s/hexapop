<script lang="ts">
  import { MAP, IDF_SOURCE, IDF_TARGET, zoomTransform } from "./map.ts";

  export type Mark = "sel" | "ok" | "ko" | "miss" | "hint" | "near" | "done-ok" | "done-ko";
  interface Props {
    marks?: Record<string, Mark>;
    fills?: Record<string, string>;
    interactive?: boolean;
    onpick?: (code: string) => void;
    label?: string;
  }
  let { marks = {}, fills, interactive = true, onpick, label = "Carte des départements" }: Props = $props();

  const codes = Object.keys(MAP.paths);
  const regions = Object.values((MAP as unknown as { regions: Record<string, string> }).regions ?? {});
  const uid = "m" + Math.random().toString(36).slice(2, 7);
  const vb = MAP.viewBox.join(" ");
  const idfT = zoomTransform(IDF_SOURCE, IDF_TARGET);

  function pickFrom(e: Event) {
    if (!interactive) return;
    const code = (e.target as Element).getAttribute?.("data-code");
    if (code) onpick?.(code);
  }
  function key(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickFrom(e); }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg class="map" class:interactive viewBox={vb} role="img" aria-label={label} onclick={pickFrom} onkeydown={key}>
  <defs>
    {#each codes as code (code)}<path id="{uid}-{code}" d={MAP.paths[code]} />{/each}
  </defs>

  {#each MAP.insets as b (b.code)}
    <rect class="frame" x={b.x} y={b.y} width={b.w} height={b.h} rx="8" />
  {/each}
  <rect class="frame" x={IDF_TARGET.x} y={IDF_TARGET.y} width={IDF_TARGET.w} height={IDF_TARGET.h} rx="8" />
  <text class="cap" x={IDF_TARGET.x + IDF_TARGET.w / 2} y={IDF_TARGET.y + IDF_TARGET.h + 16} text-anchor="middle">Paris et petite couronne</text>
  <rect class="src" x={IDF_SOURCE.x - 3} y={IDF_SOURCE.y - 3} width={IDF_SOURCE.w + 6} height={IDF_SOURCE.h + 6} rx="3" />

  <!-- Ombre rose : un léger décalage de la silhouette, la seule touche riso de la carte -->
  <g class="shadow" transform="translate(4 4)" aria-hidden="true">
    {#each codes as code (code)}<use href="#{uid}-{code}" />{/each}
  </g>

  <g class="deps">
    {#each codes as code (code)}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <use href="#{uid}-{code}" data-code={code} class={marks[code] ?? ""} style={fills?.[code] ? `--f:${fills[code]}` : undefined}
        tabindex={interactive ? 0 : -1} role={interactive ? "button" : undefined} aria-label={interactive ? "département" : undefined} />
    {/each}
  </g>
  <g class="regions" aria-hidden="true">
    {#each regions as d, i (i)}<path {d} />{/each}
  </g>
  <g class="deps zoom" transform={idfT}>
    {#each IDF_SOURCE.codes as code (code)}
      <use href="#{uid}-{code}" data-code={code} class={marks[code] ?? ""} style={fills?.[code] ? `--f:${fills[code]}` : undefined} />
    {/each}
  </g>
</svg>

<style>
  .map { display: block; width: 100%; height: auto; max-height: 100%; user-select: none; -webkit-tap-highlight-color: transparent; }
  .shadow use { fill: var(--pink); }
  .frame { fill: #fffdf8; stroke: var(--line); stroke-width: 1.5; }
  .cap { font: 700 13px var(--f-ui); fill: var(--soft); }
  .src { fill: none; stroke: var(--soft); stroke-width: 1; stroke-dasharray: 2 2; }
  .deps use { fill: var(--f, #fffdf8); stroke: #cbc2b0; stroke-width: .6; stroke-linejoin: round; transition: fill .15s; outline: none; transform-box: fill-box; transform-origin: center; }
  .regions path { fill: none; stroke: var(--ink); stroke-width: 1.5; stroke-linejoin: round; pointer-events: none; }
  .zoom use { stroke-width: .18; }
  .interactive .deps use { cursor: pointer; }
  .interactive .deps use:hover, .interactive .deps use:focus-visible { fill: #fff1a8; stroke: var(--ink); stroke-width: 1.2; }
  .deps use.hint { fill: var(--yellow); stroke: var(--ink); stroke-width: 2; animation: pulse 1s ease-in-out infinite alternate; }
  .deps use.sel { fill: var(--ink); stroke: var(--ink); }
  .deps use.near { fill: #9fd3f0; stroke: var(--ink); stroke-width: 1.2; }
  .deps use.ok { fill: var(--ok); stroke: var(--ink); stroke-width: 1.2; animation: dep-pop .45s cubic-bezier(.2, 1.8, .4, 1); }
  .deps use.ko { fill: var(--ko); stroke: var(--ink); stroke-width: 1.2; animation: shake .35s; }
  .deps use.miss { fill: var(--yellow); stroke: var(--ink); stroke-width: 2; animation: pulse .5s ease-in-out 6 alternate; }
  .deps use.done-ok { fill: var(--tint-ok); }
  .deps use.done-ko { fill: var(--tint-ko); }
  .zoom use.hint, .zoom use.sel, .zoom use.ok, .zoom use.ko, .zoom use.miss, .zoom use.near { stroke-width: .45; }
  /* Clignotement opaque : l'ombre rose ne doit pas transparaître. */
  @keyframes pulse { from { fill: var(--yellow); } to { fill: #fff6c4; } }
  @keyframes dep-pop { 0% { transform: scale(1); } 45% { transform: scale(1.28); } 100% { transform: scale(1); } }
</style>
