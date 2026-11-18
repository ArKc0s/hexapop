<script lang="ts">
  // Premier lancement : « Qu'est-ce que tu veux apprendre ? » (docs/atlas.md), puis pour les départements
  // « Tu viens d'où ? », et la première séance tout de suite (docs/conception.md, section 6).
  import { ATLASES, DEP, type AtlasId } from "@hexa/game";
  import { world } from "../world.svelte.ts";
  import Map from "../Map.svelte";
  import Mascot from "./Mascot.svelte";
  import AtlasPreview from "./AtlasPreview.svelte";
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
<main class="welcome first" style="--n:{world.offered.length}">
  <header class="hero">
    <Mascot mood="happy" size={92} />
    <div>
      <h1>Apprends la carte de France <em>en jouant.</em></h1>
      <p>Des parties de 2 minutes, sans compte. Hexa te repose ce que tu oublies, jusqu'à ce que ça rentre.</p>
    </div>
  </header>
  <h2 class="ask">Par quoi tu commences ?</h2>
  <div class="atlases">
    {#each world.offered as a, i (a)}
      <button class="atlas" onclick={() => pickAtlas(a)}>
        <div class="pic"><AtlasPreview atlas={a} delay={i * 900} /></div>
        <div class="txt">
          <b>{ATLASES[a].nom}{#if ATLASES[a].preview}<i class="new essai">Essai</i>{:else if a === "regions"}<i class="new">Nouveau</i>{/if}</b>
          <span>{ATLASES[a].promesse}</span>
          <span class="play">Jouer <span aria-hidden="true">→</span></span>
        </div>
      </button>
    {/each}
  </div>
  <p class="hint">Gratuit, sans inscription. Tu pourras changer quand tu veux, en haut de l'accueil.</p>
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
  /* Premier écran : donner envie en un coup d'œil (une promesse, deux cartes qui jouent toutes seules). */
  .first { justify-content: center; gap: 14px; max-width: max(760px, calc(var(--n, 2) * 340px)); }
  .hero { display: flex; gap: 16px; align-items: center; }
  .hero h1 { font-size: clamp(27px, 6.4vw, 44px); font-weight: 900; line-height: 1.02; letter-spacing: -.01em; }
  .hero h1 em { font-style: normal; color: var(--pink); }
  .hero p { margin-top: 8px; font-weight: 600; font-size: 17px; color: var(--soft); max-width: 34em; }
  .ask { font-size: 20px; font-weight: 900; margin-top: 10px; }
  .atlases { display: grid; grid-template-columns: repeat(var(--n, 2), minmax(0, 1fr)); gap: 14px; }
  .atlas { border: 0; background: #fff; border-radius: 24px; padding: 14px 16px 16px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 5px 0 var(--line); font: inherit; color: inherit; transition: transform .08s, box-shadow .08s; }
  .atlas:hover { box-shadow: 0 5px 0 var(--line), inset 0 0 0 3px var(--yellow); }
  .atlas:active { transform: translateY(4px); box-shadow: 0 1px 0 var(--line); }
  .pic { background: var(--bg); border-radius: 16px; padding: 10px 12px 6px; }
  .txt { display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .atlas b { font-size: 24px; font-weight: 900; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .atlas span { font-weight: 700; }
  .new { font-style: normal; font-size: 13px; font-weight: 800; background: var(--yellow); border-radius: 999px; padding: 2px 9px; }
  .play { margin-top: auto; position: relative; top: 6px; align-self: flex-start; background: var(--blue); color: #fff; border-radius: 14px; padding: 9px 16px; box-shadow: 0 4px 0 var(--blue-d); font-weight: 800 !important; }
  .atlas:nth-child(2) .play { background: var(--pink); box-shadow: 0 4px 0 var(--pink-d); }
  .atlas:nth-child(3) .play { background: var(--green); box-shadow: 0 4px 0 var(--green-d); }
  .new.essai { background: var(--ink); color: #fff; }
  @media (max-width: 640px) {
    .hero { align-items: flex-start; gap: 12px; }
    .hero :global(.mascot) { width: 64px; height: 64px; }
    .hero p { font-size: 15.5px; }
    .atlases { grid-template-columns: 1fr; gap: 12px; }
    .atlas { flex-direction: row; align-items: stretch; padding: 10px; gap: 12px; }
    .pic { width: 44%; flex: none; padding: 6px; display: flex; align-items: center; }
    .pic :global(.preview) { width: 100%; }
    .txt { padding: 4px 4px 2px 0; }
    .atlas b { font-size: 21px; }
    .atlas span { font-size: 14.5px; line-height: 1.25; }
    .play { margin-top: 8px; padding: 7px 14px; }
  }
  .welcome { max-width: 760px; margin: 0 auto; padding: 18px 16px 24px; display: flex; flex-direction: column; gap: 12px; min-height: 100dvh; }
  .hello { display: flex; gap: 12px; align-items: flex-start; }
  .bubble { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .bubble p { font-weight: 600; }
  .welcome :global(.wrap) { flex: 1; min-height: 0; }
  .go { display: flex; flex-direction: column; gap: 10px; align-items: center; position: sticky; bottom: 0; padding: 8px 0 calc(8px + env(safe-area-inset-bottom)); background: linear-gradient(transparent, var(--bg) 25%); }
  .hint { color: var(--soft); font-weight: 700; text-align: center; }
  .links { display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; }
</style>
