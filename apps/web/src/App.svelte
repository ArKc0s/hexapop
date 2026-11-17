<script lang="ts">
  import { nav, screenFromHash } from "./lib/nav.svelte.ts";
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
</script>

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

<PushPrompt />
<SignupPrompt />
