<script lang="ts">
  // Sélecteur d'atlas de l'accueil : l'atlas affiché, et un menu qui range les atlas par domaine (France, Monde…).
  // Une rangée de boutons ne tiendrait pas à 10 atlas et mélangerait les thèmes (remarque de Léo, 2026-11-18).
  import { ATLASES, byDomain, type AtlasId } from "@hexa/game";
  import { world } from "../world.svelte.ts";
  import { profile } from "../profile.svelte.ts";
  import { sound } from "../sound.svelte.ts";

  let { pct }: { pct: Record<string, number> } = $props();
  let open = $state(false);
  let root: HTMLDivElement;
  const groups = byDomain(world.offered);
  const cur = $derived(world.atlas);

  function choose(a: AtlasId) {
    open = false;
    if (world.id !== a) { profile.setAtlas(a); sound.play("tap"); }
  }
  function outside(e: PointerEvent) { if (open && !root.contains(e.target as Node)) open = false; }
  function key(e: KeyboardEvent) { if (e.key === "Escape" && open) { open = false; (root.querySelector(".cur") as HTMLElement)?.focus(); } }
</script>

<svelte:window onpointerdown={outside} onkeydown={key} />

<div class="picker" bind:this={root}>
  <button class="cur" aria-haspopup="listbox" aria-expanded={open} onclick={() => (open = !open)}>
    <span class="dom">{cur.domaine}</span>
    <b>{cur.nom}</b>
    <span class="pct tabnum">{pct[cur.id]} %</span>
    <span class="chev" aria-hidden="true">▾</span>
  </button>
  {#if open}
    <div class="menu" role="listbox" aria-label="Ce que tu apprends">
      {#each groups as g (g.domaine)}
        <div class="grp">
          <span class="gh">{g.domaine}</span>
          {#each g.atlases as a (a)}
            <button role="option" aria-selected={world.id === a} class="opt" class:on={world.id === a} onclick={() => choose(a)}>
              <span class="ot"><b>{ATLASES[a].nom}{#if ATLASES[a].preview}<i class="essai">Essai</i>{/if}</b><small>{ATLASES[a].promesse}</small></span>
              <span class="pct tabnum">{pct[a]} %</span>
            </button>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .picker { position: relative; margin: 2px 0 4px; }
  .cur { width: 100%; display: flex; align-items: baseline; gap: 8px; border: 0; background: var(--bg-2); border-radius: 18px; padding: 10px 16px; cursor: pointer; font: inherit; color: var(--ink); text-align: left; }
  .cur:hover { background: #e4dccb; }
  .dom { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: var(--soft); }
  .cur b { font-size: 17px; font-weight: 900; }
  .cur .pct { margin-left: auto; font-weight: 800; font-size: 14px; color: var(--soft); }
  .chev { font-size: 14px; color: var(--soft); transition: transform .15s; }
  .cur[aria-expanded="true"] .chev { transform: rotate(180deg); }
  .menu { position: absolute; z-index: 30; left: 0; right: 0; top: calc(100% + 6px); background: #fff; border-radius: 20px; padding: 8px; box-shadow: 0 6px 0 var(--line), 0 18px 40px rgba(28, 26, 55, .14); display: flex; flex-direction: column; gap: 6px; max-height: 70vh; overflow: auto; animation: pop-in .14s; }
  .grp { display: flex; flex-direction: column; gap: 2px; }
  .gh { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: var(--soft); padding: 6px 10px 2px; }
  .opt { display: flex; align-items: center; gap: 10px; border: 0; background: transparent; border-radius: 14px; padding: 9px 10px; cursor: pointer; font: inherit; color: inherit; text-align: left; }
  .opt:hover { background: var(--bg); }
  .opt.on { background: #fff4c2; box-shadow: inset 0 0 0 2px var(--yellow); }
  .ot { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .ot b { font-size: 16px; font-weight: 900; }
  .ot small { font-size: 13px; font-weight: 600; color: var(--soft); line-height: 1.25; }
  .opt .pct { font-weight: 800; font-size: 14px; color: var(--soft); }
  .essai { font-style: normal; font-size: 11px; font-weight: 800; background: var(--ink); color: #fff; border-radius: 999px; padding: 1px 7px; margin-left: 6px; vertical-align: 2px; }
</style>
