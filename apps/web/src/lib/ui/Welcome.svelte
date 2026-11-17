<script lang="ts">
  // Premier lancement : « Qu'est-ce que tu veux apprendre ? » (docs/atlas.md), puis pour les départements
  // « Tu viens d'où ? », et la première séance tout de suite (docs/conception.md, section 6).
  import { ATLASES, ATLAS_IDS, DEP, type AtlasId } from "@hexa/game";
  import Map from "../Map.svelte";
  import Mascot from "./Mascot.svelte";
  import { profile } from "../profile.svelte.ts";
  import { startSeance } from "../seance.svelte.ts";
  import { nav } from "../nav.svelte.ts";

  let atlas = $state<AtlasId | null>(null);
  let chosen = $state<string | null>(null);
  function pickAtlas(a: AtlasId) {
    atlas = a;
    profile.setAtlas(a);
    // Hors départements, pas besoin de savoir d'où tu viens pour commencer : on joue tout de suite.
    if (a !== "france") done(null);
  }
  const d = $derived(chosen ? DEP.get(chosen) : null);

  function done(home: string | null) {
    try { localStorage.setItem("hexa.welcomed", "1"); } catch { /* navigation privée */ }
    if (home) profile.setHome(home);
    startSeance();
  }
</script>

{#if !atlas}
<main class="welcome">
  <div class="hello">
    <Mascot mood="happy" size={72} />
    <div class="bubble">
      <b>Salut ! Moi c'est Hexa.</b>
      <p>On va apprendre la France ensemble, en jouant. <b>Qu'est-ce que tu veux apprendre ?</b></p>
    </div>
  </div>
  <div class="atlases">
    {#each ATLAS_IDS as a (a)}
      <button class="atlas" onclick={() => pickAtlas(a)}>
        <b>{ATLASES[a].nom}</b>
        <span>{ATLASES[a].promesse}</span>
        <small>{ATLASES[a].items.length} {ATLASES[a].des}</small>
      </button>
    {/each}
  </div>
  <p class="hint">Tu pourras changer quand tu veux, en haut de l'accueil.</p>
  <div class="links">
    <button class="link" onclick={() => { try { localStorage.setItem("hexa.welcomed", "1"); } catch { /* */ } nav.go({ name: "account", view: "login" }); }}>J'ai déjà un compte</button>
  </div>
</main>
{:else}
<main class="welcome">
  <div class="hello">
    <Mascot mood="happy" size={72} />
    <div class="bubble">
      <b>Salut ! Moi c'est Hexa.</b>
      <p>On va apprendre les 101 départements ensemble, en commençant par chez toi. <b>Tu viens d'où ?</b></p>
    </div>
  </div>

  <Map atlas="france" marks={chosen ? { [chosen]: "sel" } : {}} zoomable onpick={(c) => (chosen = c)} label="Choisis ton département" />

  <div class="go">
    {#if d}
      <button class="btn big wide" onclick={() => done(chosen)}>{d.nom} ({d.code}), c'est parti !</button>
    {:else}
      <p class="hint">Touche ton département sur la carte. Au doigt : la région d'abord, puis le département.</p>
    {/if}
    <div class="links">
      <button class="link" onclick={() => done(null)}>Je préfère ne pas dire</button>
      <button class="link" onclick={() => { try { localStorage.setItem("hexa.welcomed", "1"); } catch { /* */ } nav.go({ name: "account", view: "login" }); }}>J'ai déjà un compte</button>
    </div>
  </div>
</main>
{/if}

<style>
  .atlases { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 8px; }
  .atlas { border: 0; background: #fff; border-radius: 24px; padding: 20px 20px 18px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 5px 0 var(--line); font: inherit; color: inherit; transition: transform .08s, box-shadow .08s; }
  .atlas:hover { box-shadow: 0 5px 0 var(--line), inset 0 0 0 3px var(--yellow); }
  .atlas:active { transform: translateY(4px); box-shadow: 0 1px 0 var(--line); }
  .atlas b { font-size: 24px; font-weight: 900; }
  .atlas span { font-weight: 700; }
  .atlas small { color: var(--soft); font-weight: 700; }
  .welcome { max-width: 760px; margin: 0 auto; padding: 18px 16px 24px; display: flex; flex-direction: column; gap: 12px; min-height: 100dvh; }
  .hello { display: flex; gap: 12px; align-items: flex-start; }
  .bubble { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .bubble p { font-weight: 600; }
  .welcome :global(.wrap) { flex: 1; min-height: 0; }
  .go { display: flex; flex-direction: column; gap: 10px; align-items: center; position: sticky; bottom: 0; padding: 8px 0 calc(8px + env(safe-area-inset-bottom)); background: linear-gradient(transparent, var(--bg) 25%); }
  .hint { color: var(--soft); font-weight: 700; text-align: center; }
  .links { display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; }
</style>
