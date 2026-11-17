<script lang="ts">
  import { onDestroy } from "svelte";
  import { tourRegionOf, OUTRE_MER } from "@hexa/game";
  import { MAP, IDF_SOURCE, IDF_TARGET, zoomTransform } from "./map.ts";

  export type Mark = "sel" | "ok" | "ko" | "miss" | "hint" | "near" | "done-ok" | "done-ko" | "focus" | "subject";
  interface Props {
    marks?: Record<string, Mark>;
    fills?: Record<string, string>;
    interactive?: boolean;
    /** Zoom et déplacement (pincer, glisser, double-toucher) ; au doigt, toucher une région zoome dessus. */
    zoomable?: boolean;
    onpick?: (code: string) => void;
    label?: string;
    /** Mode propositions : seuls ces départements sont surlignés et sélectionnables. */
    candidates?: string[];
  }
  let { marks = {}, fills, interactive = true, zoomable = false, onpick, label = "Carte des départements", candidates }: Props = $props();
  const cand = $derived(candidates ? new Set(candidates) : null);
  const allowed = (code: string) => !cand || cand.has(code);

  const codes = Object.keys(MAP.paths);
  // Outre-mer : pas de contour de région, on lui donne un trait d'encre.
  const OM = new Set(MAP.insets.map((b) => b.code));
  const regions = Object.values((MAP as unknown as { regions: Record<string, string> }).regions ?? {});
  const uid = "m" + Math.random().toString(36).slice(2, 7);
  const idfT = zoomTransform(IDF_SOURCE, IDF_TARGET);

  // ---------- disposition : sur mobile, l'outre-mer passe en bandeau sous la métropole ----------
  const mq = typeof window !== "undefined" ? window.matchMedia("(max-width: 900px)") : null;
  const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  let narrow = $state(mq?.matches ?? false);
  const onMq = () => (narrow = mq!.matches);
  mq?.addEventListener("change", onMq);
  onDestroy(() => mq?.removeEventListener("change", onMq));

  const METRO_H = MAP.viewBox[3] - 20;
  const STRIP_Y = METRO_H + 24, STRIP_W = 1000 / MAP.insets.length;
  /** Décalage de chaque encart d'outre-mer en disposition étroite. */
  const insetShift = Object.fromEntries(MAP.insets.map((b, i) => [b.code, { dx: i * STRIP_W + (STRIP_W - b.w) / 2 - b.x, dy: STRIP_Y - b.y }]));
  const shiftOf = (code: string) => (narrow && insetShift[code] ? `translate(${insetShift[code].dx} ${insetShift[code].dy})` : undefined);
  const FULL_WIDE: number[] = [...MAP.viewBox];
  const FULL_NARROW = [-10, -10, 1020, STRIP_Y + MAP.insets[0].h + 20];
  const full = $derived(narrow ? FULL_NARROW : FULL_WIDE);

  // ---------- vue (zoom) ----------
  let view = $state<number[] | null>(null); // null = vue complète
  const vb = $derived((view ?? full).map((n) => n.toFixed(1)).join(" "));
  const zoomed = $derived(!!view);
  let anim = 0;
  function animateTo(target: number[] | null) {
    cancelAnimationFrame(anim);
    const from = view ?? full, to = target ?? full, t0 = performance.now(), D = 260;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / D), e = 1 - (1 - k) ** 3;
      const cur = from.map((v, i) => v + (to[i] - v) * e);
      view = k >= 1 ? target : cur;
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  onDestroy(() => cancelAnimationFrame(anim));
  function clamp(v: number[]): number[] {
    const [fx, fy, fw, fh] = full;
    const w = Math.max(fw * 0.1, Math.min(fw, v[2])), h = (v[3] / v[2]) * w;
    const x = Math.max(fx - w * 0.25, Math.min(fx + fw - w * 0.75, v[0]));
    const y = Math.max(fy - h * 0.25, Math.min(fy + fh - h * 0.75, v[1]));
    return [x, y, w, h];
  }
  /** Cadre d'une région (métropole), au ratio de la vue complète. */
  function regionBox(code: string): number[] {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of tourRegionOf(code).deps) for (const [, x, y] of MAP.paths[c].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) {
      x0 = Math.min(x0, +x); x1 = Math.max(x1, +x); y0 = Math.min(y0, +y); y1 = Math.max(y1, +y);
    }
    const pad = 0.12, ratio = full[3] / full[2];
    let w = (x1 - x0) * (1 + pad * 2), h = (y1 - y0) * (1 + pad * 2);
    if (h / w > ratio) w = h / ratio; else h = w * ratio;
    return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
  }
  export function resetZoom() { animateTo(null); }

  /** Cadre englobant des propositions (métropole hors petite couronne), au ratio de la vue complète. */
  function boxOf(list: string[]): number[] | null {
    if (list.some((c) => OM.has(c) || IDF_SOURCE.codes.includes(c))) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of list) for (const [, x, y] of MAP.paths[c].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) {
      x0 = Math.min(x0, +x); x1 = Math.max(x1, +x); y0 = Math.min(y0, +y); y1 = Math.max(y1, +y);
    }
    const pad = 0.25, ratio = full[3] / full[2];
    let w = Math.max((x1 - x0) * (1 + pad * 2), full[2] * 0.3), h = (y1 - y0) * (1 + pad * 2);
    if (h / w > ratio) w = h / ratio; else h = w * ratio;
    if (w >= full[2] * 0.8) return null;
    return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
  }
  // Au doigt, on zoome tout de suite sur les 4 propositions quand elles sont proches.
  $effect(() => {
    if (!zoomable || !candidates?.length || !narrow) return;
    const box = boxOf(candidates);
    if (box) animateTo(box);
  });

  // ---------- gestes ----------
  let svg: SVGSVGElement;
  const pointers = new Map<number, { x: number; y: number }>();
  let gesture: { moved: boolean; t: number; x: number; y: number; target: Element | null; pinch?: { d: number; mid: { x: number; y: number }; vb: number[] } } | null = null;
  let lastTap = { t: 0, x: 0, y: 0 };
  /** Après un zoom sur région, on ignore les touchers le temps de l'animation (évite une sélection accidentelle). */
  let lockUntil = 0;

  function toSvg(x: number, y: number) {
    const m = svg.getScreenCTM()?.inverse();
    if (!m) return { x, y };
    const p = new DOMPoint(x, y).matrixTransform(m);
    return { x: p.x, y: p.y };
  }
  function zoomAt(cx: number, cy: number, factor: number, base = view ?? full) {
    const p = toSvg(cx, cy);
    const w = base[2] / factor, h = base[3] / factor;
    const nx = p.x - (p.x - base[0]) / factor, ny = p.y - (p.y - base[1]) / factor;
    const v = clamp([nx, ny, w, h]);
    view = v[2] >= full[2] * 0.98 ? null : v;
  }

  function down(e: PointerEvent) {
    if (!zoomable) return;
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) gesture = { moved: false, t: performance.now(), x: e.clientX, y: e.clientY, target: e.target as Element };
    else if (pointers.size === 2 && gesture) {
      const [a, b] = [...pointers.values()];
      gesture.moved = true;
      gesture.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, vb: [...(view ?? full)] };
    }
  }
  function move(e: PointerEvent) {
    if (!gesture || !pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId)!;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture.pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(gesture.pinch.mid.x, gesture.pinch.mid.y, d / gesture.pinch.d, gesture.pinch.vb);
      return;
    }
    if (Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 8) gesture.moved = true;
    if (gesture.moved && view && pointers.size === 1) {
      const a = toSvg(prev.x, prev.y), b = toSvg(e.clientX, e.clientY);
      view = clamp([view[0] - (b.x - a.x), view[1] - (b.y - a.y), view[2], view[3]]);
    }
  }
  function up(e: PointerEvent) {
    if (!gesture) return;
    pointers.delete(e.pointerId);
    if (pointers.size > 0) return;
    const g = gesture;
    gesture = null;
    if (g.moved || performance.now() - g.t > 600) return;
    const now = performance.now();
    if (now < lockUntil) return;
    // Double-toucher (une fois zoomé) : zoom avant, ou retour à la vue complète si déjà très zoomé
    if (view && now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
      lastTap = { t: 0, x: 0, y: 0 };
      if (view && view[2] < full[2] * 0.3) animateTo(null);
      else { const before = view; zoomAt(e.clientX, e.clientY, 2.2); const target = view; view = before; animateTo(target); }
      return;
    }
    lastTap = { t: now, x: e.clientX, y: e.clientY };
    tap(g.target);
  }

  function tap(target: Element | null) {
    const code = target?.getAttribute?.("data-code");
    if (!code || !interactive) return;
    if (cand) {
      if (!cand.has(code)) return;
      if (navigator.vibrate) navigator.vibrate(15);
      onpick?.(code);
      return;
    }
    const inZoomBox = !!target?.closest(".zoom");
    // Au doigt, vue complète : toucher une région de métropole zoome dessus d'abord.
    if (zoomable && coarse && !view && !OM.has(code) && !inZoomBox && tourRegionOf(code).code !== OUTRE_MER) {
      animateTo(regionBox(code));
      lockUntil = performance.now() + 400;
      lastTap = { t: 0, x: 0, y: 0 };
      if (navigator.vibrate) navigator.vibrate(8);
      return;
    }
    if (navigator.vibrate) navigator.vibrate(15);
    onpick?.(code);
  }
  function wheel(e: WheelEvent) {
    // Pincement au pavé tactile (ctrl + molette) : zoom ; la molette seule fait défiler la page.
    if (!zoomable || !e.ctrlKey) return;
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
  }

  function pickFrom(e: Event) {
    if (!interactive || zoomable) return; // les cartes zoomables gèrent le toucher elles-mêmes
    const code = (e.target as Element).getAttribute?.("data-code");
    if (code && allowed(code)) onpick?.(code);
  }
  function key(e: KeyboardEvent) {
    if (!interactive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const code = (e.target as Element).getAttribute?.("data-code");
      if (code && allowed(code)) onpick?.(code);
    }
  }
</script>

<div class="wrap" class:zoomable>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <svg bind:this={svg} class="map" class:interactive class:zoomable class:choosing={!!cand} viewBox={vb} role="img" aria-label={label}
    onclick={pickFrom} onkeydown={key} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onwheel={wheel}>
    <defs>
      {#each codes as code (code)}<path id="{uid}-{code}" d={MAP.paths[code]} />{/each}
    </defs>

    {#each MAP.insets as b (b.code)}
      <rect class="frame" x={b.x} y={b.y} width={b.w} height={b.h} rx="8" transform={shiftOf(b.code)} />
    {/each}
    <rect class="frame" x={IDF_TARGET.x} y={IDF_TARGET.y} width={IDF_TARGET.w} height={IDF_TARGET.h} rx="8" />
    <text class="cap" x={IDF_TARGET.x + IDF_TARGET.w / 2} y={IDF_TARGET.y + IDF_TARGET.h + 16} text-anchor="middle">Paris et petite couronne</text>
    <rect class="src" x={IDF_SOURCE.x - 3} y={IDF_SOURCE.y - 3} width={IDF_SOURCE.w + 6} height={IDF_SOURCE.h + 6} rx="3" />

    <!-- Ombre rose : un léger décalage de la silhouette, la seule touche riso de la carte -->
    <g class="shadow" transform="translate(4 4)" aria-hidden="true">
      {#each codes as code (code)}<use href="#{uid}-{code}" transform={shiftOf(code)} />{/each}
    </g>

    <g class="deps">
      {#each codes as code (code)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <use href="#{uid}-{code}" data-code={code} class="{marks[code] ?? ''} {OM.has(code) ? 'om' : ''} {cand?.has(code) ? 'cand' : ''}" style={fills?.[code] ? `--f:${fills[code]}` : undefined}
          transform={shiftOf(code)} tabindex={interactive && allowed(code) ? 0 : -1} role={interactive ? "button" : undefined} aria-label={interactive ? "département" : undefined} />
      {/each}
    </g>
    <g class="regions" aria-hidden="true">
      {#each regions as d, i (i)}<path {d} />{/each}
    </g>
    <g class="deps zoom" transform={idfT}>
      {#each IDF_SOURCE.codes as code (code)}
        <use href="#{uid}-{code}" data-code={code} class="{marks[code] ?? ''} {cand?.has(code) ? 'cand' : ''}" style={fills?.[code] ? `--f:${fills[code]}` : undefined} />
      {/each}
    </g>
  </svg>
  {#if zoomable && zoomed}
    <button class="out" onclick={() => animateTo(null)}>← Toute la France</button>
  {/if}
</div>

<style>
  .wrap { position: relative; }
  .map { display: block; width: 100%; height: auto; max-height: 100%; user-select: none; -webkit-tap-highlight-color: transparent; }
  /* Carte zoomable : on capte les gestes (pincer, glisser) au lieu de zoomer la page. */
  .map.zoomable { touch-action: none; }
  .out { position: absolute; left: 8px; top: 8px; border: 0; background: var(--ink); color: #fff; font-weight: 800; font-size: 14px; padding: 8px 12px; border-radius: 999px; cursor: pointer; box-shadow: 0 3px 0 #000; }
  .deps use.sel, .interactive .deps use.sel:hover { fill: var(--ink); stroke: var(--yellow) !important; stroke-width: 3 !important; paint-order: stroke; }
  /* Épaisseur des traits constante à l'écran, quel que soit le zoom */
  .deps use, .regions path, .frame, .src { vector-effect: non-scaling-stroke; }
  .shadow use { fill: var(--pink); }
  .frame { fill: #fffdf8; stroke: #d6cdb9; stroke-width: 1.5; }
  .cap { font: 700 13px var(--f-ui); fill: var(--soft); }
  .src { fill: none; stroke: var(--soft); stroke-width: 1; stroke-dasharray: 2 2; }
  .deps use { fill: var(--f, #fffdf8); stroke: #9a907c; stroke-width: .75; stroke-linejoin: round; transition: fill .15s; outline: none; transform-box: fill-box; transform-origin: center; }
  .deps use.om { stroke: var(--ink); stroke-width: 1.5; }
  .regions path { fill: none; stroke: var(--ink); stroke-width: 1.7; stroke-linejoin: round; pointer-events: none; }
  .zoom use { stroke-width: .8; stroke: #8a806c; }
  .interactive .deps use { cursor: pointer; }
  /* Région choisie pour la prochaine séance (accueil) : simple contour, la couleur reste celle de la maîtrise */
  .deps use.focus { stroke: var(--ink); stroke-width: 2.2; stroke-dasharray: 5 3; }
  /* Propositions sur la carte : 4 départements surlignés, les autres en retrait */
  .choosing .deps use:not(.cand) { cursor: default; fill: #f4efe4; }
  .deps use.cand { fill: #fff1a8; stroke: var(--ink); stroke-width: 1.8; }
  .deps use.cand.sel { fill: var(--ink); stroke: var(--yellow) !important; stroke-width: 3 !important; }
  .interactive .deps use:focus-visible { fill: #fff1a8; stroke: var(--ink); stroke-width: 1.2; }
  @media (hover: hover) { .interactive.choosing .deps use.cand:not(.sel):hover { fill: var(--yellow); } .interactive:not(.choosing) .deps use:hover { fill: #fff1a8; stroke: var(--ink); stroke-width: 1.2; } }
  .deps use.hint { fill: var(--yellow); stroke: var(--ink); stroke-width: 2; animation: pulse 1s ease-in-out infinite alternate; }
  .deps use.sel { fill: var(--ink); stroke: var(--ink); }
  .deps use.near { fill: #9fd3f0; stroke: var(--ink); stroke-width: 1.2; }
  .deps use.ok { fill: var(--ok); stroke: var(--ink); stroke-width: 1.2; animation: dep-pop .45s cubic-bezier(.2, 1.8, .4, 1); }
  .deps use.ko { fill: var(--ko); stroke: var(--ink); stroke-width: 1.2; animation: shake .35s; }
  /* Correction : la bonne réponse qu'on n'a pas trouvée clignote en vert, puis reste vert clair cerclé de vert */
  .deps use.miss { fill: var(--tint-ok); stroke: var(--ok-d); stroke-width: 2.4; animation: pulse-ok .5s ease-in-out 6 alternate; }
  /* Le département de la question (quand il ne fallait pas le placer) : jaune, comme quand il clignotait */
  .deps use.subject { fill: var(--yellow); stroke: var(--ink); stroke-width: 2; }
  .deps use.done-ok { fill: var(--tint-ok); }
  .deps use.done-ko { fill: var(--tint-ko); }
  .zoom use.hint, .zoom use.sel, .zoom use.ok, .zoom use.ko, .zoom use.miss, .zoom use.near, .zoom use.subject { stroke-width: 1.4; }
  /* Clignotement opaque : l'ombre rose ne doit pas transparaître. */
  @keyframes pulse-ok { from { fill: var(--ok); } to { fill: var(--tint-ok); } }
  @keyframes pulse { from { fill: var(--yellow); } to { fill: #fff6c4; } }
  @keyframes dep-pop { 0% { transform: scale(1); } 45% { transform: scale(1.28); } 100% { transform: scale(1); } }
</style>
