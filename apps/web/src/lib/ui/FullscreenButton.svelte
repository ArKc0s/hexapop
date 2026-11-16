<script lang="ts">
  // Plein écran pendant une partie (Android, ordinateur). Masqué sur iPhone et dans l'appli installée.
  import { onDestroy } from "svelte";
  import { install } from "../install.svelte.ts";
  const show = install.fullscreenAvailable && install.mobile && !install.standalone;
  onDestroy(() => install.exitFullscreen());
</script>

{#if show}
  <button class="fs" onclick={() => install.toggleFullscreen()} aria-label={install.fullscreen ? "Quitter le plein écran" : "Plein écran"}>
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      {#if install.fullscreen}<path d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" />{:else}<path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" />{/if}
    </svg>
  </button>
{/if}

<style>
  .fs { border: 0; background: #fff; width: 38px; height: 38px; border-radius: 12px; cursor: pointer; box-shadow: 0 3px 0 var(--line); display: grid; place-items: center; color: var(--ink); flex: none; }
</style>
