<script lang="ts">
  import { ITEM, flagUrl, shortCode } from "@hexa/game";
  import { depShape } from "../shapes.ts";

  // Vignette de collection : la silhouette du département, son numéro, son nom.
  // Le palier donne le fini (bronze, argent, or) ; l'outre-mer est holographique.
  const NAMES = ["", "bronze", "argent", "or"];
  /** tier : 0 = à découvrir. size : s (pastille), m (album), l (récompense). */
  let { code, tier = 1, size = "m", label = true }: { code: string; tier?: number; size?: "s" | "m" | "l"; label?: boolean } = $props();
  const d = $derived(ITEM.get(code)!);
  const short = $derived(shortCode(code));
  // Monde : le drapeau plutôt que la silhouette (archipels, territoires lointains : une silhouette s'y lirait mal).
  const flag = $derived(code.startsWith("W"));
  const shape = $derived(flag ? null : depShape(code));
  const uid = "g" + Math.random().toString(36).slice(2, 8);
</script>

<span class="vg {size} t{tier}" class:missing={!tier} class:holo={d.outreMer && tier > 0}
  role="img" aria-label={tier ? `${d.nom} (${short}), vignette ${NAMES[tier]}` : `Vignette à découvrir`}>
  <span class="wrap"><span class="art">
    {#if flag}
      {#if tier}<img class="fl" src={flagUrl(code)} alt="" loading="lazy" decoding="async" />{:else}<span class="fl ghostflag"></span>{/if}
    {:else if shape}
    <svg viewBox={shape.viewBox} aria-hidden="true">
      <defs>
        <linearGradient id="{uid}" x1="0" y1="0" x2="1" y2="1">
          {#if tier === 3}<stop offset="0" stop-color="#ffe680" /><stop offset=".5" stop-color="#f5c518" /><stop offset="1" stop-color="#c99a12" />
          {:else if tier === 2}<stop offset="0" stop-color="#f3f6fa" /><stop offset=".5" stop-color="#b9c3d0" /><stop offset="1" stop-color="#8994a3" />
          {:else}<stop offset="0" stop-color="#f2c79f" /><stop offset=".5" stop-color="#d69a63" /><stop offset="1" stop-color="#a86a35" />{/if}
        </linearGradient>
      </defs>
      {#if tier}
        <path d={shape.d} class="shadow" />
        <path d={shape.d} class="body" style="fill:url(#{uid})" />
      {:else}
        <path d={shape.d} class="ghost" />
      {/if}
    </svg>
    {/if}
  </span>{#if size !== "s"}<span class="code">{tier ? short : "?"}</span>{/if}</span>
  {#if label && size !== "s"}<span class="nm">{tier ? d.nom : "À découvrir"}</span>{/if}
  {#if size === "s"}<span class="code-s">{tier ? short : "?"}</span>{/if}
</span>

<style>
  .vg { --w: 132px; display: inline-flex; flex-direction: column; align-items: center; gap: 12px; width: var(--w); flex: none; }
  .vg.l { --w: 168px; }
  .vg.s { --w: 54px; gap: 2px; }
  .wrap { position: relative; width: 100%; }
  .art { position: relative; width: 100%; aspect-ratio: 1; border-radius: 22%; display: grid; place-items: center; background: #fff; box-shadow: inset 0 0 0 3px var(--ring, #efe8da); overflow: hidden; }
  .s .art { border-radius: 30%; box-shadow: inset 0 0 0 2px var(--ring, #efe8da); }
  .t1 { --ring: #e2b48a; }
  .t2 { --ring: #c9d1dc; }
  .t3 { --ring: #f5c518; }
  .t3 .art { background: radial-gradient(circle at 50% 35%, #fff9dc, #fff 70%); }
  svg { width: 70%; height: 70%; overflow: visible; }
  .fl { width: 72%; aspect-ratio: 4 / 3; border-radius: 8%; object-fit: cover; box-shadow: 3px 3px 0 var(--pink), 0 0 0 1.5px var(--ink); }
  .ghostflag { display: block; box-shadow: none; border: 1.6px dashed #c3b9a6; }
  .shadow { fill: var(--pink); transform: translate(2.5%, 2.5%); transform-box: fill-box; }
  .body { stroke: var(--ink); stroke-width: 1.4; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .ghost { fill: none; stroke: #c3b9a6; stroke-width: 1.6; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; }
  .code { position: absolute; right: -4px; bottom: -6px; font-family: var(--f-pop); font-size: calc(var(--w) * .14); line-height: 1; color: #fff; background: var(--ink); padding: 5px 9px 6px; border-radius: 999px; box-shadow: 0 0 0 3px var(--card, #fff); z-index: 1; }
  .code-s { font-family: var(--f-pop); font-size: 12px; line-height: 1; }
  .nm { font-weight: 800; font-size: 14px; text-align: center; line-height: 1.15; }
  .l .nm { font-size: 16px; }
  .missing .art { background: rgba(255, 255, 255, .5); box-shadow: inset 0 0 0 2px #e4dccb; }
  .missing .code-s, .missing .nm { color: #b9af9b; }
  .missing .code { background: #e4dccb; color: #fff; }
  /* Reflet métallique qui passe sur l'or */
  .t3 .art::after { content: ""; position: absolute; inset: -40%; background: linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, .75) 50%, transparent 60%); transform: translateX(-60%); animation: shine 4.5s ease-in-out infinite; pointer-events: none; }
  @keyframes shine { 0%, 65% { transform: translateX(-60%); } 100% { transform: translateX(60%); } }
  /* Outre-mer : fond holographique */
  .holo .art { background: linear-gradient(120deg, #fff 10%, #ffdcf0 28%, #d5efff 44%, #fff6c8 60%, #dcffe9 74%, #fff 90%); background-size: 260% 100%; animation: holo 4s linear infinite; }
  @keyframes holo { to { background-position: -260% 0; } }
</style>
