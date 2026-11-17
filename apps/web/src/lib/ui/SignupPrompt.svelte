<script lang="ts">
  // Fenêtre « Garde ta progression » : ce que l'invité risque de perdre, ce que le compte apporte, en un geste.
  // Quand et à quelle fréquence : voir signup.svelte.ts.
  import { signup } from "../signup.svelte.ts";
  import { session } from "../api.svelte.ts";
  import { nav } from "../nav.svelte.ts";
  import { profile } from "../profile.svelte.ts";
  import { stakeOf } from "../stake.ts";
  import Mascot from "./Mascot.svelte";
  import Icon from "./Icon.svelte";
  import ProviderIcon from "./ProviderIcon.svelte";
  import { live } from "../socket.svelte.ts";

  const r = $derived(signup.reason);
  const inGame = $derived(nav.screen.name === "play" || (nav.screen.name === "live" && !live.ranking) || (nav.screen.name === "daily" && !!live.question && !live.daily));
  const show = $derived(!!r && session.online && session.ready && !session.me && !inGame);
  const daily = $derived(r?.kind === "daily");
  const stake = $derived(stakeOf(profile.data));
  const title = $derived(daily ? "Joue sous ton vrai pseudo" : r?.moment ? `Bravo pour ${r.moment} !` : r?.firstGame ? "Première séance réussie !" : "Garde ta progression");
  const lead = $derived.by(() => {
    if (daily) return r?.guestName ? `Aujourd'hui tu es classé comme « ${r.guestName} ». Avec un compte, ton score passe sous ton pseudo, et tu entres au Hall of Fame.` : "Avec un compte, ton score passe sous ton pseudo, et tu entres au Hall of Fame.";
    return stake.text ? `${stake.text[0].toUpperCase()}${stake.text.slice(1)} : tout ça n'existe que sur cet appareil. Un compte le met à l'abri.` : "Pour l'instant ta progression n'existe que sur cet appareil. Un compte la met à l'abri.";
  });
  const quick = $derived(session.providers.length > 0);
  function go(view: "register" | "login") {
    const then = daily ? ({ name: "daily" } as const) : ({ name: "home" } as const);
    signup.accept();
    nav.go({ name: "account", view, then });
  }
  const remember = () => { try { sessionStorage.setItem("hexa.returnTo", daily ? "#defi" : ""); } catch { /* rien */ } signup.accept(); };
</script>

{#if show}
  <div class="veil" role="presentation">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sp-t">
      <Mascot mood="wow" size={64} />
      <h2 id="sp-t">{title}</h2>
      {#if r?.xp && !daily}<p class="gains">+{r.xp} km{r.stars ? ` et ${r.stars} étoile${r.stars > 1 ? "s" : ""}` : ""} à l'instant</p>{/if}
      <p>{lead}</p>
      <ul class="why">
        <li><Icon name="check" size={14} />Ta progression sauvegardée, sur tous tes appareils</li>
        <li><Icon name="check" size={14} />Ton pseudo au classement du jour et au Hall of Fame</li>
        <li><Icon name="check" size={14} />Gratuit et sans pub{quick ? ", 10 secondes avec " + session.providers.map((p) => p.label).slice(0, 2).join(" ou ") : ""}</li>
      </ul>
      <div class="row">
        {#each session.providers as p (p.id)}
          <a class="btn white wide prov" href="/api/auth/oauth/{p.id}/start" onclick={remember}><ProviderIcon id={p.id} />Continuer avec {p.label}</a>
        {/each}
        <button class="btn big wide" onclick={() => go("register")}>{quick ? "Avec mon e-mail" : "Créer mon compte"}</button>
        <button class="link" onclick={() => go("login")}>J'ai déjà un compte</button>
        <div class="later">
          <button class="link soft" onclick={() => signup.close()}>Plus tard</button>
          {#if signup.canStop}<span aria-hidden="true">·</span><button class="link soft" onclick={() => signup.stop()}>Ne plus me proposer</button>{/if}
        </div>
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
  .why { list-style: none; margin: 2px 0 0; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; text-align: left; background: var(--bg); border-radius: 16px; width: 100%; font-weight: 700; font-size: 15px; }
  .why li { display: flex; gap: 8px; align-items: center; }
  .why :global(.ic) { flex: none; color: #fff; background: var(--green); border-radius: 50%; padding: 3px; width: 20px; height: 20px; }
  .row { display: flex; flex-direction: column; gap: 8px; align-items: center; width: 100%; margin-top: 6px; }
  .prov { box-shadow: 0 4px 0 var(--line), inset 0 0 0 2px var(--line); }
  .later { display: flex; gap: 8px; align-items: center; color: var(--soft); }
  .soft { color: var(--soft); font-weight: 600; }
  @media (min-width: 701px) { .veil { place-items: center; } }
  @keyframes fade { from { opacity: 0; } }
  @keyframes up { from { transform: translateY(40px); opacity: 0; } }
</style>
