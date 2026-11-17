<script lang="ts">
  // Incitation à créer un compte / se connecter en fin de partie, pour un invité.
  import { session } from "../api.svelte.ts";
  import { nav, type Screen } from "../nav.svelte.ts";
  import ProviderIcon from "./ProviderIcon.svelte";
  import { profile } from "../profile.svelte.ts";
  import { signup } from "../signup.svelte.ts";
  import { stakeOf } from "../stake.ts";
  let { then, daily = false }: { then?: Screen; daily?: boolean } = $props();
  const stake = $derived(stakeOf(profile.data).text);
  const remember = () => { try { sessionStorage.setItem("hexa.returnTo", daily ? "#defi" : ""); } catch { /* rien */ } };
</script>

{#if session.online && session.ready && !session.me}
  {#if signup.never}
    <!-- L'invité a dit non : une ligne, pas plus -->
    <p class="mini">Tu joues en invité, ta progression reste sur cet appareil. <button class="link" onclick={() => nav.go({ name: "account", view: "register", then })}>Créer un compte</button></p>
  {:else}
  <div class="save">
    <b>{daily ? "Joue sous ton vrai pseudo" : "Ne perds pas ta progression"}</b>
    <p>{daily ? "Crée un compte ou connecte-toi : ce défi passe sous ton pseudo, au classement et au Hall of Fame." : `${stake ? stake[0].toUpperCase() + stake.slice(1) + " : t" : "T"}out ça n'existe que sur cet appareil. Avec un compte, c'est sauvegardé et tu le retrouves partout.`}</p>
    <div class="row">
      {#each session.providers as p (p.id)}
        <a class="btn white small" href="/api/auth/oauth/{p.id}/start" onclick={remember}><ProviderIcon id={p.id} size={18} />{p.label}</a>
      {/each}
      <button class="btn small" onclick={() => nav.go({ name: "account", view: "register", then })}>Créer un compte</button>
      <button class="link" onclick={() => nav.go({ name: "account", view: "login", then })}>J'ai déjà un compte</button>
    </div>
  </div>
  {/if}
{/if}

<style>
  .save { background: #fff; border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 6px; border: 2px solid var(--yellow); text-align: left; width: min(460px, 100%); }
  .save b { font-weight: 900; font-size: 17px; }
  .save p { color: var(--soft); font-weight: 600; font-size: 14px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 6px; }
  .row .btn { margin-bottom: 4px; }
  .mini { color: var(--soft); font-weight: 600; font-size: 14px; text-align: center; }
</style>
