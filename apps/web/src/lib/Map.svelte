<script lang="ts">
  import { MAP, IDF_SOURCE, IDF_TARGET, TINT_BY_DEP, zoomTransform } from "./map.ts";

  export type Mark = "sel" | "ok" | "ko" | "miss" | "hint" | "near";
  interface Props {
    marks?: Record<string, Mark>;
    fills?: Record<string, string>;
    tints?: boolean;
    interactive?: boolean;
    onpick?: (code: string) => void;
    label?: string;
  }
  let { marks = {}, fills, tints = true, interactive = true, onpick, label = "Carte des départements" }: Props = $props();

  const codes = Object.keys(MAP.paths);
  const uid = "m" + Math.random().toString(36).slice(2, 7);
  const vb = MAP.viewBox.join(" ");
  const idfT = zoomTransform(IDF_SOURCE, IDF_TARGET);

  function fillFor(code: string) {
    if (fills?.[code]) return fills[code];
    return tints ? TINT_BY_DEP[code] : "var(--paper)";
  }
  function click(e: MouseEvent) {
    if (!interactive) return;
    const code = (e.target as Element).getAttribute?.("data-code");
    if (code) onpick?.(code);
  }
  function key(e: KeyboardEvent) {
    if (!interactive) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    const code = (e.target as Element).getAttribute?.("data-code");
    if (code) { e.preventDefault(); onpick?.(code); }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg class="map" class:interactive viewBox={vb} role="img" aria-label={label} onclick={click} onkeydown={key}>
  <defs>
    {#each codes as code (code)}
      <path id="{uid}-{code}" d={MAP.paths[code]} />
    {/each}
  </defs>

  {#each MAP.insets as b (b.code)}
    <rect class="frame" x={b.x} y={b.y} width={b.w} height={b.h} rx="10" />
  {/each}
  <rect class="frame" x={IDF_TARGET.x} y={IDF_TARGET.y} width={IDF_TARGET.w} height={IDF_TARGET.h} rx="10" />
  <rect class="src" x={IDF_SOURCE.x - 3} y={IDF_SOURCE.y - 3} width={IDF_SOURCE.w + 6} height={IDF_SOURCE.h + 6} rx="3" />
  <line class="src" x1={IDF_SOURCE.x + IDF_SOURCE.w + 3} y1={IDF_SOURCE.y} x2={IDF_TARGET.x} y2={IDF_TARGET.y + IDF_TARGET.h} />

  <!-- Ombre rose décalée : silhouette uniquement, dessinée en premier -->
  <g class="shadow" transform="translate(6 6)" aria-hidden="true">
    {#each codes as code (code)}<use href="#{uid}-{code}" />{/each}
  </g>

  <g class="deps">
    {#each codes as code (code)}
      <use href="#{uid}-{code}" data-code={code} class={marks[code] ?? ""} style="--f:{fillFor(code)}"
        tabindex={interactive ? 0 : -1} role={interactive ? "button" : undefined} aria-label={interactive ? "département" : undefined} />
    {/each}
  </g>
  <g class="deps zoom" transform={idfT}>
    {#each IDF_SOURCE.codes as code (code)}
      <use href="#{uid}-{code}" data-code={code} class={marks[code] ?? ""} style="--f:{fillFor(code)}" />
    {/each}
  </g>
</svg>

<style>
  .map { display: block; width: 100%; height: 100%; user-select: none; -webkit-tap-highlight-color: transparent; }
  .shadow use { fill: var(--pink); stroke: var(--pink); stroke-width: 2; }
  .frame { fill: var(--paper); stroke: var(--ink); stroke-width: 2; stroke-dasharray: 6 5; }
  .src { fill: none; stroke: var(--ink); stroke-width: 1.2; stroke-dasharray: 3 3; }
  .deps use { fill: var(--f); stroke: var(--ink); stroke-width: .9; stroke-linejoin: round; transition: fill .12s; outline: none; }
  .zoom use { stroke-width: .25; }
  .interactive .deps use { cursor: pointer; }
  .interactive .deps use:hover, .interactive .deps use:focus-visible { fill: var(--yellow); }
  .deps use.sel { fill: var(--yellow); stroke-width: 2.4; }
  .deps use.near { fill: #9fd3f0; stroke-width: 1.8; }
  .deps use.hint { fill: var(--yellow); stroke-width: 2.4; animation: blink 1s ease-in-out infinite alternate; }
  .deps use.ok { fill: var(--ok); }
  .deps use.ko { fill: var(--ko); }
  .deps use.miss { fill: var(--blue); animation: blink .6s ease-in-out 4 alternate; }
  .zoom use.sel, .zoom use.hint, .zoom use.near { stroke-width: .6; }
  @keyframes blink { from { fill-opacity: 1; } to { fill-opacity: .45; } }
</style>
