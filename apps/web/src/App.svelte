<script lang="ts">
  import { nav, screenFromHash } from "./lib/nav.svelte.ts";
  import { bugUrl } from "./lib/version.ts";
  import UpdateBanner from "./lib/ui/UpdateBanner.svelte";
  import PseudoPrompt from "./lib/ui/PseudoPrompt.svelte";
  import { updater } from "./lib/update.svelte.ts";
  import { session } from "./lib/api.svelte.ts";
  import Home from "./screens/Home.svelte";
  import Play from "./screens/Play.svelte";
  import Results from "./screens/Results.svelte";
  import Account from "./screens/Account.svelte";
  import Daily from "./screens/Daily.svelte";
  import Lobby from "./screens/Lobby.svelte";
  import Live from "./screens/Live.svelte";
  import Stage from "./screens/Stage.svelte";
  import Legal from "./screens/Legal.svelte";
  import Training from "./screens/Training.svelte";
  import Album from "./screens/Album.svelte";
  import HallOfFame from "./screens/HallOfFame.svelte";
  import Reminders from "./screens/Reminders.svelte";
  import { push } from "./lib/push.svelte.ts";
  import PushPrompt from "./lib/ui/PushPrompt.svelte";
  import { startPresence } from "./lib/presence.ts";
  import SignupPrompt from "./lib/ui/SignupPrompt.svelte";

  nav.screen = screenFromHash();
  // Retour de connexion externe : on nettoie l'adresse (le lien ne doit pas se rejouer).
  if (location.hash.startsWith("#oauth-")) history.replaceState(null, "", location.pathname);
  // Lien modifié à la main ou bouton précédent : on suit le nouveau lien.
  window.addEventListener("hashchange", () => (nav.screen = screenFromHash()));
  // Le pied de page de présentation (index.html) n'apparaît que sous l'accueil.
  $effect(() => { document.body.classList.toggle("on-home", nav.screen.name === "home"); });
  session.load();
  push.init();
  updater.start();
  startPresence();
</script>

<!-- Filet de sécurité : un écran qui plante affiche un message au lieu de laisser un bouton qui ne fait rien. -->
{#key nav.screen}
<svelte:boundary onerror={(e) => console.error("[écran]", e)}>
{#if nav.screen.name === "home"}<Home />
{:else if nav.screen.name === "play"}{#key nav.screen}<Play config={nav.screen.config} title={nav.screen.title} learn={nav.screen.learn} mode={nav.screen.mode} region={nav.screen.region} />{/key}
{:else if nav.screen.name === "results"}{#key nav.screen}<Results {...nav.screen} />{/key}
{:else if nav.screen.name === "training"}<Training preset={nav.screen.preset} />
{:else if nav.screen.name === "album"}<Album tab={nav.screen.tab} />
{:else if nav.screen.name === "hof"}<HallOfFame />
{:else if nav.screen.name === "rappels"}<Reminders />
{:else if nav.screen.name === "account"}{#key nav.screen}<Account {...nav.screen} />{/key}
{:else if nav.screen.name === "daily"}<Daily />
{:else if nav.screen.name === "lobby"}<Lobby join={nav.screen.join} />
{:else if nav.screen.name === "live"}<Live />
{:else if nav.screen.name === "stage"}<Stage code={nav.screen.code} />
{:else if nav.screen.name === "legal"}<Legal doc={nav.screen.doc} />
{/if}
  {#snippet failed()}
    <main class="page crash">
      <h1 class="title">Oups, cet écran a planté</h1>
      <p>Ta progression est enregistrée. Reviens à l'accueil pour continuer, et si ça se reproduit, dis-le-nous : la version du jeu est jointe automatiquement.</p>
      <div class="row"><button class="btn big" onclick={() => nav.go({ name: "home" })}>Retour à l'accueil</button><a class="link" href={bugUrl()} target="_blank" rel="noopener">Signaler le bug</a></div>
    </main>
  {/snippet}
</svelte:boundary>
{/key}

<PushPrompt />
<UpdateBanner />
<PseudoPrompt />
<SignupPrompt />

<style>
  .crash { --w: 560px; display: flex; flex-direction: column; gap: 14px; }
  .crash p { margin: 0; font-weight: 600; color: var(--soft); }
  .crash .row { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
</style>
