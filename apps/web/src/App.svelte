<script lang="ts">
  import { nav, screenFromHash } from "./lib/nav.svelte.ts";
  import { session } from "./lib/api.svelte.ts";
  import Home from "./screens/Home.svelte";
  import Setup from "./screens/Setup.svelte";
  import Play from "./screens/Play.svelte";
  import Results from "./screens/Results.svelte";
  import Atlas from "./screens/Atlas.svelte";
  import Account from "./screens/Account.svelte";
  import Daily from "./screens/Daily.svelte";
  import Lobby from "./screens/Lobby.svelte";
  import Live from "./screens/Live.svelte";
  import Stage from "./screens/Stage.svelte";

  nav.screen = screenFromHash();
  session.load();
</script>

{#if nav.screen.name === "home"}<Home />
{:else if nav.screen.name === "setup"}<Setup mode={nav.screen.mode} />
{:else if nav.screen.name === "play"}{#key nav.screen}<Play {...nav.screen} />{/key}
{:else if nav.screen.name === "results"}<Results {...nav.screen} />
{:else if nav.screen.name === "atlas"}<Atlas />
{:else if nav.screen.name === "account"}{#key nav.screen}<Account {...nav.screen} />{/key}
{:else if nav.screen.name === "daily"}<Daily />
{:else if nav.screen.name === "lobby"}<Lobby join={nav.screen.join} />
{:else if nav.screen.name === "live"}<Live />
{:else if nav.screen.name === "stage"}<Stage code={nav.screen.code} />
{/if}
