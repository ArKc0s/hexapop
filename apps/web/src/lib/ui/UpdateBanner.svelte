<script lang="ts">
  // Bandeau discret quand une nouvelle version est en ligne (jamais pendant une partie). Voir update.svelte.ts.
  import { updater } from "../update.svelte.ts";
</script>

{#if updater.available && updater.safe}
  <div class="upd" role="status">
    <span>Nouvelle version d'Hexa</span>
    <button class="btn small" onclick={() => updater.apply()}>Mettre à jour</button>
  </div>
{/if}

<style>
  .upd { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(14px + env(safe-area-inset-bottom)); z-index: 60;
    display: flex; align-items: center; gap: 12px; background: var(--ink); color: #fff; font-weight: 800; font-size: 14px;
    padding: 8px 8px 8px 16px; border-radius: 999px; box-shadow: 0 6px 18px rgba(28, 26, 55, .25); animation: pop-in .25s; white-space: nowrap; }
  .upd :global(.btn) { padding: 6px 14px; }
</style>
