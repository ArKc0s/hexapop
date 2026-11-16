<script lang="ts">
  // Demande unique d'activer les rappels, à la connexion (ou à la prochaine visite d'un joueur déjà inscrit).
  // Jamais pendant une partie. La vraie demande d'autorisation du téléphone ne vient qu'après « Oui ».
  import { push } from "../push.svelte.ts";
  import { session } from "../api.svelte.ts";
  import { nav } from "../nav.svelte.ts";
  import Mascot from "./Mascot.svelte";

  const CALM = new Set(["home", "account", "results", "album", "tour", "training", "atlas"]);
  const show = $derived(!!session.me && push.supported && push.available && !push.endpoint && push.permission === "default" && !push.asked && CALM.has(nav.screen.name));
  let busy = $state(false), err = $state("");
  async function yes() {
    busy = true; err = "";
    try { const ok = await push.subscribe(); push.markAsked(); if (!ok) err = ""; }
    catch { err = "Impossible d'activer les notifications sur cet appareil."; }
    busy = false;
  }
</script>

{#if show}
  <div class="veil" role="presentation">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pp-t">
      <Mascot mood="happy" size={64} />
      <h2 id="pp-t">On te prévient pour le défi du jour ?</h2>
      <p>Une notification quand le nouveau défi arrive, et si ta série est sur le point de s'arrêter. Jamais plus d'une par jour, et tout se règle dans ton profil.</p>
      {#if err}<p class="err">{err}</p>{/if}
      <div class="row">
        <button class="btn big" onclick={yes} disabled={busy}>Oui, préviens-moi</button>
        <button class="link" onclick={() => push.markAsked()} disabled={busy}>Plus tard</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .veil { position: fixed; inset: 0; background: rgba(28, 26, 55, .35); display: grid; place-items: end center; z-index: 50; padding: 16px; animation: fade .2s; }
  .sheet { background: #fff; border-radius: 28px; padding: 24px 22px calc(20px + env(safe-area-inset-bottom)); width: min(460px, 100%); display: flex; flex-direction: column; gap: 10px; align-items: center; text-align: center; animation: up .3s cubic-bezier(.2, 1.2, .4, 1); }
  h2 { font-size: 22px; font-weight: 900; }
  p { color: var(--soft); font-weight: 600; }
  .row { display: flex; flex-direction: column; gap: 10px; align-items: center; width: 100%; margin-top: 6px; }
  .row .btn { width: 100%; }
  @media (min-width: 701px) { .veil { place-items: center; } }
  @keyframes fade { from { opacity: 0; } }
  @keyframes up { from { transform: translateY(40px); opacity: 0; } }
</style>
