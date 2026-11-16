<script lang="ts">
  import StageView from "../lib/StageView.svelte";
  import { live } from "../lib/socket.svelte.ts";
  import { nav } from "../lib/nav.svelte.ts";

  let { code }: { code: string } = $props();
  // svelte-ignore state_referenced_locally
  live.connect("Écran", () => live.join(code, true));
</script>

<main class="stagepage">
  {#if live.error && !live.room}
    <p class="err">{live.error.message}</p>
    <button class="btn" onclick={() => nav.go({ name: "home" })}>Accueil</button>
  {:else if live.ranking}
    <h1 class="riso" data-t="PODIUM">PODIUM</h1>
    <ol class="podium">
      {#each live.ranking.slice(0, 3) as p, i (p.id)}<li class="p{i}"><b>{p.name}</b><span class="tabnum">{p.score} pts</span></li>{/each}
    </ol>
  {:else}
    <StageView />
  {/if}
</main>

<style>
  .stagepage { padding: 20px 28px; max-width: 1800px; margin: 0 auto; }
  .err { font-weight: 600; color: #b0005f; }
  h1 { font-size: 96px; margin: 0 0 20px; text-align: center; }
  .podium { list-style: none; padding: 0; display: flex; justify-content: center; align-items: flex-end; gap: 20px; }
  .podium li { border: 3px solid var(--ink); border-radius: var(--r); padding: 20px; display: flex; flex-direction: column; align-items: center; min-width: 200px; background: #fff; }
  .podium b { font-family: var(--f-pop); font-weight: 400; font-size: 30px; }
  .p0 { order: 2; background: var(--yellow) !important; min-height: 220px; }
  .p1 { order: 1; min-height: 170px; }
  .p2 { order: 3; min-height: 130px; }
</style>
