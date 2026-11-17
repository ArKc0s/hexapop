<script lang="ts">
  // Premier lancement : « Tu viens d'où ? », puis la première séance tout de suite (docs/conception.md, section 6).
  import { DEP } from "@hexa/game";
  import Map from "../Map.svelte";
  import Mascot from "./Mascot.svelte";
  import { profile } from "../profile.svelte.ts";
  import { startSeance } from "../seance.svelte.ts";
  import { nav } from "../nav.svelte.ts";

  let chosen = $state<string | null>(null);
  const d = $derived(chosen ? DEP.get(chosen) : null);

  function done(home: string | null) {
    try { localStorage.setItem("hexa.welcomed", "1"); } catch { /* navigation privée */ }
    if (home) profile.setHome(home);
    startSeance();
  }
</script>

<main class="welcome">
  <div class="hello">
    <Mascot mood="happy" size={72} />
    <div class="bubble">
      <b>Salut ! Moi c'est Hexa.</b>
      <p>On va apprendre les 101 départements ensemble, en commençant par chez toi. <b>Tu viens d'où ?</b></p>
    </div>
  </div>

  <Map marks={chosen ? { [chosen]: "sel" } : {}} zoomable onpick={(c) => (chosen = c)} label="Choisis ton département" />

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

<style>
  .welcome { max-width: 760px; margin: 0 auto; padding: 18px 16px 24px; display: flex; flex-direction: column; gap: 12px; min-height: 100dvh; }
  .hello { display: flex; gap: 12px; align-items: flex-start; }
  .bubble { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .bubble p { font-weight: 600; }
  .welcome :global(.wrap) { flex: 1; min-height: 0; }
  .go { display: flex; flex-direction: column; gap: 10px; align-items: center; position: sticky; bottom: 0; padding: 8px 0 calc(8px + env(safe-area-inset-bottom)); background: linear-gradient(transparent, var(--bg) 25%); }
  .hint { color: var(--soft); font-weight: 700; text-align: center; }
  .links { display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; }
</style>
