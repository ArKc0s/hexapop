<script lang="ts">
  // Après une inscription via Google, Discord, Twitch ou Apple : le pseudo vient du service (souvent le prénom).
  // On le montre et on laisse le changer avant qu'il apparaisse dans les classements.
  import { api, ApiError, session, type Me } from "../api.svelte.ts";
  import { welcomeAccount } from "../nav.svelte.ts";
  import { profile } from "../profile.svelte.ts";
  import Mascot from "./Mascot.svelte";

  let pseudo = $state("");
  let error = $state("");
  let busy = $state(false);
  const open = $derived(welcomeAccount.ask && !!session.me);
  // Pré-rempli une seule fois, à l'ouverture. (Avant : « si le champ est vide, remettre le pseudo du service » se
  // redéclenchait dès qu'on effaçait la dernière lettre, impossible de vider le champ pour taper autre chose.)
  let filled = false;
  $effect(() => {
    if (!open) { filled = false; return; }
    if (!filled) { filled = true; pseudo = session.me!.pseudo; }
  });

  async function save() {
    const p = pseudo.trim();
    error = "";
    const body: Record<string, string> = {};
    if (p !== session.me!.pseudo) body.pseudo = p;
    // Département choisi au premier lancement (« Tu viens d'où ? ») : il devient celui du compte.
    if (!session.me!.home && profile.data.home) body.home = profile.data.home;
    if (Object.keys(body).length) {
      busy = true;
      try { session.me = (await api<{ user: Me }>("PATCH", "/me", body)).user; }
      catch (e) { error = e instanceof ApiError ? e.message : "Impossible d'enregistrer, réessaie."; busy = false; return; }
      busy = false;
    }
    welcomeAccount.ask = false;
  }
</script>

{#if open}
  <div class="veil" role="presentation">
    <form class="sheet" role="dialog" aria-modal="true" aria-labelledby="pp-t" onsubmit={(e) => { e.preventDefault(); save(); }}>
      <Mascot mood="happy" size={64} />
      <h2 id="pp-t">Bienvenue sur Hexa !</h2>
      <p>Voici ton pseudo dans les classements et entre amis. Tu peux le changer maintenant (ou plus tard dans ton profil).</p>
      <label class="label" for="pp-in">Ton pseudo</label>
      <input id="pp-in" class="field" maxlength="20" autocomplete="nickname" bind:value={pseudo} />
      {#if error}<p class="err" role="alert">{error}</p>{/if}
      <button class="btn big wide" disabled={busy || pseudo.trim().length < 2}>{pseudo.trim() === session.me?.pseudo ? "C'est bon" : "Enregistrer ce pseudo"}</button>
    </form>
  </div>
{/if}

<style>
  .veil { position: fixed; inset: 0; background: rgba(28, 26, 55, .35); display: grid; place-items: end center; z-index: 55; padding: 16px; }
  .sheet { background: #fff; border-radius: 28px; padding: 24px 22px calc(20px + env(safe-area-inset-bottom)); width: min(460px, 100%); display: flex; flex-direction: column; gap: 10px; align-items: center; text-align: center; }
  h2 { font-size: 22px; font-weight: 900; margin: 0; }
  p { color: var(--soft); font-weight: 600; margin: 0; }
  .label { align-self: flex-start; }
  .field { width: 100%; text-align: center; font-size: 20px; font-weight: 800; }
  .err { color: var(--pink-d); }
  @media (min-width: 701px) { .veil { place-items: center; } }
</style>
