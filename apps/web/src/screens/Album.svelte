<script lang="ts">
  import { BADGES, DEP, MAX_TIER_POINTS, TOUR_REGIONS, platesOwned, tierPoints } from "@hexa/game";
  import Vignette from "../lib/ui/Vignette.svelte";
  import Icon from "../lib/ui/Icon.svelte";
  import { nav } from "../lib/nav.svelte.ts";
  import { profile } from "../lib/profile.svelte.ts";

  let { tab = "plaques" }: { tab?: "plaques" | "badges" } = $props();
  // svelte-ignore state_referenced_locally
  let cur = $state(tab);
  let region = $state<string | null>(null);
  const p = $derived(profile.data);
  const shown = $derived(TOUR_REGIONS.filter((r) => !region || r.code === region));
  const got = (codes: string[]) => codes.reduce((n, c) => n + (p.tiers[c] ?? 0), 0);
  const TIER = ["À découvrir", "Bronze", "Argent", "Or"];
  const fmt = (t: number) => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
</script>

<main class="album">
  <header>
    <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
    <div class="seg"><button class:on={cur === "plaques"} onclick={() => (cur = "plaques")}>Vignettes</button><button class:on={cur === "badges"} onclick={() => (cur = "badges")}>Badges</button></div>
  </header>

  {#if cur === "plaques"}
    <div class="top">
      <div><span class="k">Ton album · {platesOwned(p)} départements</span><div class="riso big" data-t="{tierPoints(p)} / {MAX_TIER_POINTS}">{tierPoints(p)} / {MAX_TIER_POINTS}</div></div>
      <p>Réussis un département sans faute pour gagner sa vignette : <b>bronze</b> avec 4 propositions, <b>argent</b> au clavier, <b>or</b> en expert. Celles d'outre-mer sont holographiques.</p>
    </div>
    <div class="tabs">
      <button class="chip" class:on={!region} onclick={() => (region = null)}>Toutes</button>
      {#each TOUR_REGIONS as r (r.code)}<button class="chip" class:on={region === r.code} onclick={() => (region = r.code)}>{r.nom} {got(r.deps)}/{r.deps.length * 3}</button>{/each}
    </div>
    {#each shown as r (r.code)}
      <section>
        <h2>{r.nom} <span>{got(r.deps)}/{r.deps.length * 3}</span></h2>
        <div class="grid">
          {#each r.deps as c (c)}
            {@const tier = p.tiers[c] ?? 0}
            <div class="st" class:miss={!tier}><Vignette code={c} {tier} />{#if tier}<em class="tr t{tier}">{TIER[tier]}</em>{/if}</div>
          {/each}
        </div>
      </section>
    {/each}
  {:else}
    <div class="top">
      <div><span class="k">Tes badges</span><div class="riso big" data-t="{Object.keys(p.badges).length} / {BADGES.length}">{Object.keys(p.badges).length} / {BADGES.length}</div></div>
    </div>
    <div class="badges">
      {#each BADGES as b (b.id)}
        {@const at = p.badges[b.id]}
        <div class="bd" class:off={!at}>
          <span class="ico"><Icon name={at ? "trophy" : "lock"} size={24} /></span>
          <div><b>{b.nom}</b><small>{b.desc}</small>{#if at}<em>Obtenu le {fmt(at)}</em>{/if}</div>
        </div>
      {/each}
    </div>
  {/if}
</main>

<style>
  .album { max-width: 1100px; margin: 0 auto; padding: 18px 20px 48px; display: flex; flex-direction: column; gap: 16px; }
  header { display: flex; justify-content: space-between; align-items: center; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; flex-wrap: wrap; }
  .top p { color: var(--soft); font-weight: 600; max-width: 46ch; }
  .big { font-size: 48px; }
  .tabs { display: flex; flex-wrap: wrap; gap: 6px; }
  section { display: flex; flex-direction: column; gap: 10px; }
  h2 { font-size: 19px; font-weight: 900; }
  h2 span { color: var(--soft); font-weight: 700; font-size: 15px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(156px, 1fr)); gap: 12px; }
  .st { background: #fff; border-radius: 18px; padding: 16px 12px 12px; display: flex; flex-direction: column; gap: 6px; align-items: center; text-align: center; box-shadow: 0 4px 0 var(--line); }

  .st small { font-weight: 700; color: var(--soft); font-size: 13px; }
  .st.miss { background: rgba(255, 255, 255, .45); box-shadow: none; }
  .badges { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }
  .bd { background: #fff; border-radius: 18px; padding: 14px; display: flex; gap: 12px; align-items: center; box-shadow: 0 4px 0 var(--line); }
  .bd > div { display: flex; flex-direction: column; gap: 2px; }
  .bd small { color: var(--soft); font-weight: 600; font-size: 13.5px; }
  .bd em { font-style: normal; font-size: 12px; font-weight: 700; color: var(--green-d); }
  .ico { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; flex: none; background: var(--yellow); box-shadow: 0 3px 0 var(--yellow-d); }
  .bd.off { background: transparent; box-shadow: none; border: 2px dashed #d7cfbe; }
  .bd.off .ico { background: var(--bg-2); box-shadow: none; color: var(--soft); }
  .tr { font-style: normal; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; padding: 2px 7px; border-radius: 999px; color: #fff; }
  .tr.t1 { background: #a86a35; } .tr.t2 { background: #7f8a99; } .tr.t3 { background: #c99a12; }
</style>
