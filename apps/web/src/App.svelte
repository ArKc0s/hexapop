<script lang="ts">
  import { nav } from "./lib/nav.svelte.ts";
  import Home from "./screens/Home.svelte";
  import Setup from "./screens/Setup.svelte";
  import Play from "./screens/Play.svelte";
  import Results from "./screens/Results.svelte";
  import Atlas from "./screens/Atlas.svelte";
</script>

{#if nav.screen.name === "home"}<Home />
{:else if nav.screen.name === "setup"}<Setup mode={nav.screen.mode} />
{:else if nav.screen.name === "play"}{#key nav.screen}<Play {...nav.screen} />{/key}
{:else if nav.screen.name === "results"}<Results {...nav.screen} />
{:else if nav.screen.name === "atlas"}<Atlas />
{/if}
