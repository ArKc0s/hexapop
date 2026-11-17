<script lang="ts">
  // L'Album : ta collection (médailles), la carte avec la fiche de chaque département (ex-Atlas), et tes succès.
  import { BADGES, DEPARTEMENTS, TOUR_REGIONS, BASE_FACETS, medalCounts, medalOf, starsOf, tarnished, type Facet } from "@hexa/game";
  import Map, { type Mark } from "../lib/Map.svelte";
  import Fiche from "../lib/Fiche.svelte";
  import Vignette from "../lib/ui/Vignette.svelte";
  import Icon from "../lib/ui/Icon.svelte";
  import { nav, type AlbumTab } from "../lib/nav.svelte.ts";
  import { profile } from "../lib/profile.svelte.ts";
  import { knowFills } from "../lib/knowFills.ts";

  let { tab = "medailles" }: { tab?: AlbumTab } = $props();
  // svelte-ignore state_referenced_locally
  let cur = $state<AlbumTab>(tab);
  let region = $state<string | null>(null);
  /** Département dont la fiche est ouverte. */
  let open = $state<string | null>(null);
  let focus = $state("75");

  const p = $derived(profile.data);
  const know = $derived(p.know ?? {});
  const now = Date.now();
  const shown = $derived(TOUR_REGIONS.filter((r) => !region || r.code === region));
  const got = (codes: string[]) => codes.reduce((n, c) => n + starsOf(know, c), 0);
  const counts = $derived(medalCounts(know));
  const owned = $derived(counts[1] + counts[2] + counts[3]);
  const TIER = ["À découvrir", "Bronze", "Argent", "Or"];
  const FACET: Record<string, string> = { carte: "Le placer", numero: "Son numéro", prefecture: "Sa préfecture" };
  const fmt = (t: number) => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  const starred = (c: string, f: Facet) => !!know[c]?.[f]?.s;

  // Onglet Carte
  const fills = $derived(knowFills(know, now));
  const regionDeps = $derived(region ? TOUR_REGIONS.find((r) => r.code === region)?.deps ?? [] : []);
  const marks = $derived.by(() => {
    const m: Record<string, Mark> = {};
    for (const c of regionDeps) m[c] = "focus";
    m[focus] = "sel";
    return m;
  });
  const list = $derived(DEPARTEMENTS.filter((d) => !region || regionDeps.includes(d.code)));
</script>

<svelte:window onkeydown={(e) => { if (e.key === "Escape") open = null; }} />

{#snippet card(c: string)}
  <!-- Ce que tu sais du département : sa médaille et ses trois étoiles -->
  {@const tier = medalOf(know, c)}
  <div class="mine">
    <span class="tr t{tier}">{TIER[tier]}{tier && tarnished(know, c, now) ? " · à réviser" : ""}</span>
    <ul>
      {#each BASE_FACETS as f (f)}<li class:on={starred(c, f)}><i>★</i>{FACET[f]}</li>{/each}
    </ul>
  </div>
  <Fiche code={c} />
{/snippet}

<main class="album page" class:wide={cur === "carte"}>
  <header>
    <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
    <div class="seg">
      <button class:on={cur === "medailles"} onclick={() => (cur = "medailles")}>Médailles</button>
      <button class:on={cur === "carte"} onclick={() => (cur = "carte")}>Carte</button>
      <button class:on={cur === "succes"} onclick={() => (cur = "succes")}>Succès</button>
    </div>
  </header>

  {#if cur !== "succes"}
    <div class="tabs">
      <button class="chip" class:on={!region} onclick={() => (region = null)}>Toutes</button>
      {#each TOUR_REGIONS as r (r.code)}<button class="chip" class:on={region === r.code} onclick={() => (region = r.code)}>{r.nom} <span>{got(r.deps)}/{r.deps.length * 3}</span></button>{/each}
    </div>
  {/if}

  {#if cur === "medailles"}
    <div class="top">
      <div><span class="k">Ton album · {counts[1]} bronze · {counts[2]} argent · {counts[3]} or</span><div class="riso big" data-t="{owned} / 101">{owned} / 101</div></div>
      <p>Chaque département a 3 étoiles : le placer, son numéro, sa préfecture, gagnées en répondant juste sans aide. <b>Bronze</b> avec les 3, <b>argent</b> quand tu les as retenues sur plusieurs jours, <b>or</b> avec en plus ses sous-préfectures et ses voisins. Touche un département pour voir sa fiche.</p>
    </div>
    {#each shown as r (r.code)}
      <section>
        <h2>{r.nom} <span>{got(r.deps)}/{r.deps.length * 3}</span></h2>
        <div class="grid">
          {#each r.deps as c (c)}
            {@const tier = medalOf(know, c)}
            {@const s = starsOf(know, c)}
            <button class="st" class:miss={!tier} class:dull={tier > 0 && tarnished(know, c, now)} onclick={() => (open = c)} aria-label="Fiche du département {c}">
              <Vignette code={c} {tier} />
              {#if tier}<em class="tr t{tier}">{TIER[tier]}{tarnished(know, c, now) ? " · à réviser" : ""}</em>
              {:else}<span class="mini" aria-label="{s} étoile{s > 1 ? 's' : ''} sur 3">{#each [0, 1, 2] as k (k)}<i class:on={k < s}>★</i>{/each}</span>{/if}
            </button>
          {/each}
        </div>
      </section>
    {/each}
  {:else if cur === "carte"}
    <div class="atlas">
      <section class="side">
        {@render card(focus)}
        <div class="list">
          {#each list as d (d.code)}<button class:on={focus === d.code} onclick={() => (focus = d.code)}><b class="tabnum">{d.code}</b> {d.nom}</button>{/each}
        </div>
      </section>
      <section class="mapcol">
        <Map {fills} {marks} onpick={(c) => (focus = c)} label="Carte de ta collection : touche un département pour voir sa fiche" />
      </section>
    </div>
  {:else}
    <div class="top">
      <div><span class="k">Tes succès</span><div class="riso big" data-t="{Object.keys(p.badges).length} / {BADGES.length}">{Object.keys(p.badges).length} / {BADGES.length}</div></div>
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

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="veil" onclick={() => (open = null)}>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Fiche du département" tabindex="-1" onclick={(e) => e.stopPropagation()}>
      {@render card(open)}
      <div class="sa">
        <button class="btn white small" onclick={() => { focus = open!; open = null; cur = "carte"; }}>Voir sur la carte</button>
        <button class="btn small" onclick={() => (open = null)}>Fermer</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .album { --w: 1100px; display: flex; flex-direction: column; gap: 16px; }
  .album.wide { --w: 1320px; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; flex-wrap: wrap; }
  .top p { color: var(--soft); font-weight: 600; max-width: 46ch; }
  .top > div { display: flex; flex-direction: column; gap: 4px; }
  .big { font-size: 48px; line-height: 1; }
  .tabs { display: flex; flex-wrap: wrap; gap: 6px; }
  .tabs .chip span { font-weight: 700; opacity: .6; }
  section { display: flex; flex-direction: column; gap: 10px; }
  h2 { font-size: 19px; font-weight: 900; }
  h2 span { color: var(--soft); font-weight: 700; font-size: 15px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(156px, 1fr)); gap: 12px; }
  .st { border: 0; font: inherit; color: inherit; cursor: pointer; background: #fff; border-radius: 18px; padding: 16px 12px 12px; display: flex; flex-direction: column; gap: 6px; align-items: center; text-align: center; box-shadow: 0 4px 0 var(--line); }
  .st:hover { transform: translateY(-2px); }
  .st:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--line); }
  .st.miss { background: rgba(255, 255, 255, .45); box-shadow: none; }
  .st.dull :global(.art) { filter: saturate(.35); }
  .mini { font-size: 16px; letter-spacing: 2px; color: #d7cfbe; }
  .mini i { font-style: normal; }
  .mini i.on { color: var(--yellow-d); }
  .tr { font-style: normal; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; padding: 2px 7px; border-radius: 999px; color: #fff; align-self: flex-start; }
  .st .tr { align-self: center; }
  .tr.t0 { background: var(--bg-2); color: var(--soft); }
  .tr.t1 { background: #a86a35; } .tr.t2 { background: #7f8a99; } .tr.t3 { background: #c99a12; }

  /* Ce que tu sais : médaille et étoiles par facette, au-dessus de la fiche */
  .mine { display: flex; flex-direction: column; gap: 8px; }
  .mine ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 14px; }
  .mine li { font-weight: 800; font-size: 14px; color: var(--soft); display: flex; align-items: center; gap: 5px; }
  .mine li i { font-style: normal; font-size: 17px; color: #d7cfbe; }
  .mine li.on { color: var(--ink); }
  .mine li.on i { color: var(--yellow-d); }

  .atlas { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr); gap: 28px; align-items: start; }
  .side { display: flex; flex-direction: column; gap: 14px; }
  .list { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; max-height: 320px; overflow: auto; font-size: 14px; }
  .list button { background: none; border: 0; text-align: left; padding: 3px 4px; cursor: pointer; border-radius: 6px; font: inherit; color: inherit; }
  .list button.on { background: var(--yellow); }
  .mapcol { position: sticky; top: 12px; }

  .badges { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }
  .bd { background: #fff; border-radius: 18px; padding: 14px; display: flex; gap: 12px; align-items: center; box-shadow: 0 4px 0 var(--line); }
  .bd > div { display: flex; flex-direction: column; gap: 2px; }
  .bd small { color: var(--soft); font-weight: 600; font-size: 13.5px; }
  .bd em { font-style: normal; font-size: 12px; font-weight: 700; color: var(--green-d); }
  .ico { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; flex: none; background: var(--yellow); box-shadow: 0 3px 0 var(--yellow-d); }
  .bd.off { background: transparent; box-shadow: none; border: 2px dashed #d7cfbe; }
  .bd.off .ico { background: var(--bg-2); box-shadow: none; color: var(--soft); }

  .veil { position: fixed; inset: 0; background: rgba(28, 25, 51, .45); display: grid; place-items: center; padding: 20px; z-index: 50; animation: pop-in .15s; }
  .sheet { background: var(--bg); border-radius: 24px; padding: 20px; width: min(440px, 100%); display: flex; flex-direction: column; gap: 14px; box-shadow: 0 6px 0 rgba(0, 0, 0, .15); }
  .sa { display: flex; gap: 10px; justify-content: flex-end; }
  @media (max-width: 860px) {
    .atlas { grid-template-columns: 1fr; }
    .mapcol { position: static; order: -1; }
    .veil { place-items: end center; padding: 0; }
    .sheet { border-radius: 24px 24px 0 0; width: 100%; padding-bottom: calc(20px + env(safe-area-inset-bottom)); }
    header .seg button { padding-inline: 10px; }
  }
</style>
