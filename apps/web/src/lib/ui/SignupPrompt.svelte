<script lang="ts">
  import { signup } from "../signup.svelte.ts";
  import { session } from "../api.svelte.ts";
  import { nav } from "../nav.svelte.ts";
  import Mascot from "./Mascot.svelte";
  import ProviderIcon from "./ProviderIcon.svelte";
  import { live } from "../socket.svelte.ts";

  const r = $derived(signup.reason);
  const inGame = $derived(nav.screen.name === "play" || nav.screen.name === "setup" || (nav.screen.name === "live" && !live.ranking) || (nav.screen.name === "daily" && !!live.question && !live.daily));
  const show = $derived(!!r && session.online && session.ready && !session.me && !inGame);
  const daily = $derived(r?.kind === "daily");
  const gains = $derived.by(() => {
    if (!r) return "";
    const parts = [r.xp ? `+${r.xp} XP` : "", r.stars ? `${r.stars} étoile${r.stars > 1 ? "s" : ""}` : ""].filter(Boolean);
    return parts.join(" et ");
  });
  function go(view: "register" | "login") {
    const then = daily ? ({ name: "daily" } as const) : ({ name: "home" } as const);
    signup.close();
    nav.go({ name: "account", view, then });
  }
  const remember = () => { try { sessionStorage.setItem("hexa.returnTo", daily ? "#defi" : ""); } catch { /* rien */ } signup.close(); };
</script>

{#if show}
  <div class="veil" role="presentation">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sp-t">
      <Mascot mood="wow" size={64} />
      <h2 id="sp-t">{daily ? "Entre au classement du jour" : "Garde ta progression !"}</h2>
      {#if gains && !daily}<p class="gains">{gains} gagnés à l'instant</p>{/if}
      <p>{daily
        ? "Ton défi n'est pas encore classé. Crée un compte ou connecte-toi : il sera ajouté à ton compte et compté dans le classement."
        : "En invité, ta progression n'existe que sur cet appareil et peut disparaître. Avec un compte, cette partie y est ajoutée et tu la retrouves partout."}</p>
      <div class="row">
        {#each session.providers as p (p.id)}
          <a class="btn white wide prov" href="/api/auth/oauth/{p.id}/start" onclick={remember}><ProviderIcon id={p.id} />Continuer avec {p.label}</a>
        {/each}
        <button class="btn big wide" onclick={() => go("register")}>Créer mon compte</button>
        <button class="link" onclick={() => go("login")}>J'ai déjà un compte</button>
        <button class="link soft" onclick={() => signup.close()}>Plus tard</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .veil { position: fixed; inset: 0; background: rgba(28, 26, 55, .35); display: grid; place-items: end center; z-index: 50; padding: 16px; animation: fade .2s; }
  .sheet { background: #fff; border-radius: 28px; padding: 24px 22px calc(20px + env(safe-area-inset-bottom)); width: min(460px, 100%); display: flex; flex-direction: column; gap: 10px; align-items: center; text-align: center; animation: up .3s cubic-bezier(.2, 1.2, .4, 1); max-height: calc(100dvh - 32px); overflow: auto; }
  h2 { font-size: 22px; font-weight: 900; }
  p { color: var(--soft); font-weight: 600; }
  .gains { color: var(--green-d); font-weight: 900; font-size: 17px; }
  .row { display: flex; flex-direction: column; gap: 8px; align-items: center; width: 100%; margin-top: 6px; }
  .prov { box-shadow: 0 4px 0 var(--line), inset 0 0 0 2px var(--line); }
  .soft { color: var(--soft); font-weight: 600; }
  @media (min-width: 701px) { .veil { place-items: center; } }
  @keyframes fade { from { opacity: 0; } }
  @keyframes up { from { transform: translateY(40px); opacity: 0; } }
</style>
