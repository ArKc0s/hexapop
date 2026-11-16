<script lang="ts">
  import { DEPARTEMENTS, REGIONS } from "@hexa/game";
  import Map, { type Mark } from "../lib/Map.svelte";
  import Fiche from "../lib/Fiche.svelte";
  import { nav } from "../lib/nav.svelte.ts";

  let focus = $state<string>("75");
  let region = $state<string | null>(null);
  const marks = $derived.by(() => {
    const m: Record<string, Mark> = {};
    if (region) for (const d of DEPARTEMENTS) if (d.region === region) m[d.code] = "near";
    m[focus] = "sel";
    return m;
  });
  const list = $derived(DEPARTEMENTS.filter((d) => !region || d.region === region));
</script>

<main class="atlas">
  <section class="side">
    <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
    <h1 class="riso" data-t="ATLAS">ATLAS</h1>
    <p>Clique un département pour voir sa fiche. Révise région par région avant de jouer.</p>
    <div class="regs">
      <button class="chip" class:on={!region} onclick={() => (region = null)}>Toutes</button>
      {#each REGIONS as r (r.code)}<button class="chip" class:on={region === r.code} onclick={() => (region = r.code)}>{r.nom}</button>{/each}
    </div>
    <Fiche code={focus} />
    <div class="list">
      {#each list as d (d.code)}<button class:on={focus === d.code} onclick={() => (focus = d.code)}><b class="tabnum">{d.code}</b> {d.nom}</button>{/each}
    </div>
  </section>
  <section class="mapcol"><Map {marks} onpick={(c) => (focus = c)} label="Atlas des départements" /></section>
</main>

<style>
  .atlas { max-width: 1320px; margin: 0 auto; padding: 24px 20px 48px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr); gap: 28px; align-items: start; }
  .side { display: flex; flex-direction: column; gap: 14px; }
  .back { align-self: flex-start; background: none; border: 0; cursor: pointer; font-weight: 600; padding: 0; }
  h1 { font-size: 64px; margin: 0; }
  p { margin: 0; }
  .regs { display: flex; flex-wrap: wrap; gap: 6px; }
  .regs .chip { cursor: pointer; }
  .list { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; max-height: 320px; overflow: auto; font-size: 14px; }
  .list button { background: none; border: 0; text-align: left; padding: 3px 4px; cursor: pointer; border-radius: 6px; }
  .list button.on { background: var(--yellow); }
  .mapcol { position: sticky; top: 12px; }
  @media (max-width: 860px) { .atlas { grid-template-columns: 1fr; } .mapcol { position: static; order: -1; } }
</style>
