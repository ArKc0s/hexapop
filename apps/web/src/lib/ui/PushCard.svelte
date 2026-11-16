<script lang="ts">
  // Invitation (opt-in) aux rappels, après une partie.
  import { push } from "../push.svelte.ts";
  let busy = $state(false), done = $state(false), err = $state("");
  async function on() {
    busy = true; err = "";
    try { done = await push.subscribe(); if (!done) err = "Autorisation refusée : tu pourras la réactiver dans les réglages du téléphone."; }
    catch { err = "Impossible d'activer les notifications sur cet appareil."; }
    busy = false;
  }
</script>

{#if push.suggest || done}
  <div class="pc">
    {#if done}
      <b>C'est noté ! 🔔</b><p>Un rappel par jour au maximum. Tout se règle dans « Rappels ».</p>
    {:else}
      <b>Te prévenir pour le défi du jour ?</b>
      <p>Une notification quand le défi arrive, et si ta série est sur le point de s'arrêter. Jamais plus d'une par jour.</p>
      <div class="row">
        <button class="btn small" onclick={on} disabled={busy}>Me prévenir</button>
        <button class="link" onclick={() => push.dismiss()}>Non merci</button>
      </div>
      {#if err}<p class="err">{err}</p>{/if}
    {/if}
  </div>
{/if}

<style>
  .pc { background: #fff; border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 6px; border: 2px dashed var(--line); text-align: left; width: min(460px, 100%); }
  .pc b { font-weight: 900; font-size: 16px; }
  .pc p { color: var(--soft); font-weight: 600; font-size: 14px; }
  .row { display: flex; gap: 12px; align-items: center; margin-top: 4px; }
  .row .btn { margin-bottom: 4px; }
  .err { color: var(--pink-d) !important; }
</style>
