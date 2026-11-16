<script lang="ts">
  import { DEPARTEMENTS, mastery } from "@hexa/game";
  import Map from "../lib/Map.svelte";
  import { nav } from "../lib/nav.svelte.ts";
  import { progress } from "../lib/progress.svelte.ts";
  import { session } from "../lib/api.svelte.ts";
  import { masteryFills } from "../lib/mastery.ts";
  import { rankFor } from "../lib/rank.ts";

  const all = DEPARTEMENTS.map((d) => d.code);
  const mastered = $derived(mastery(progress.data, all));
  const rank = $derived(rankFor(mastered));
  const fills = $derived(masteryFills(progress.data));
  let soloOpen = $state(false);
</script>

<main class="home">
  <nav class="top">
    {#if session.me}
      <button class="chip" onclick={() => nav.go({ name: "account", view: "profile" })}>{session.me.pseudo}{session.me.home ? ` · ${session.me.home}` : ""}</button>
    {:else if session.online}
      <button class="chip" onclick={() => nav.go({ name: "account", view: "login" })}>Se connecter</button>
    {/if}
  </nav>

  <section class="hero">
    <h1 class="riso logo" data-t="HEXA">HEXA</h1>
    <p class="pitch">101 départements, leurs numéros, leurs préfectures. Pars de zéro, finis incollable, puis défie tes potes.</p>
    <div class="rank">
      <span class="big tabnum">{mastered}</span>
      <div><b>{rank.name}</b><span>{mastered}/101 maîtrisés{rank.next ? ` · ${rank.toNext} avant ${rank.next}` : ""}</span></div>
    </div>

    <div class="doors">
      <button class="door daily" disabled={!session.online} onclick={() => nav.go({ name: "daily" })}>
        <b>Défi du jour</b><span>10 départements, les mêmes pour tout le monde, un seul essai.</span>
      </button>
      <button class="door" aria-expanded={soloOpen} onclick={() => (soloOpen = !soloOpen)}>
        <b>Jouer seul</b><span>Apprendre, réviser, enchaîner.</span>
      </button>
      {#if soloOpen}
        <div class="modes">
          <button class="mode" onclick={() => nav.go({ name: "setup", mode: "apprendre" })}><b>Apprendre</b><span>12 départements choisis pour toi</span></button>
          <button class="mode" onclick={() => nav.go({ name: "setup", mode: "eclair" })}><b>Éclair</b><span>20 au hasard</span></button>
          <button class="mode" onclick={() => nav.go({ name: "setup", mode: "region" })}><b>Par région</b><span>une région à fond</span></button>
          <button class="mode" onclick={() => nav.go({ name: "setup", mode: "marathon" })}><b>Marathon</b><span>les 101, sans pitié</span></button>
          <button class="mode" onclick={() => nav.go({ name: "atlas" })}><b>Atlas</b><span>réviser la carte</span></button>
        </div>
      {/if}
      <button class="door friends" disabled={!session.online} onclick={() => nav.go({ name: "lobby" })}>
        <b>Avec des amis</b><span>Duel en direct ou soirée plateau jusqu'à 100 joueurs.</span>
      </button>
    </div>
    {#if !session.online}<p class="off">Version de démonstration : le défi du jour et le multi arrivent avec le serveur.</p>{/if}
  </section>

  <section class="mapcol" aria-label="Ta maîtrise sur la carte">
    <Map fills={fills} tints={false} interactive={false} label="Carte de ta maîtrise des départements" />
    <div class="legend"><i style="background:var(--tint-a)"></i>à revoir <i style="background:var(--yellow)"></i>en cours <i style="background:var(--blue)"></i>maîtrisé</div>
  </section>
</main>

<style>
  .home { max-width: 1240px; margin: 0 auto; padding: 20px 20px 48px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 12px 32px; align-items: center; }
  .top { grid-column: 1 / -1; display: flex; justify-content: flex-end; min-height: 30px; }
  .top .chip { cursor: pointer; background: #fff; }
  .hero { display: flex; flex-direction: column; gap: 18px; }
  .logo { font-size: clamp(72px, 12vw, 132px); margin: 0; }
  .pitch { font-size: 18px; max-width: 34ch; margin: 0; }
  .rank { display: flex; align-items: center; gap: 12px; }
  .rank .big { font-family: var(--f-pop); font-size: 52px; line-height: 1; }
  .rank div { display: flex; flex-direction: column; }
  .rank b { font-family: var(--f-pop); font-weight: 400; font-size: 20px; text-transform: uppercase; }
  .rank span { font-size: 13px; color: var(--ink-soft); }
  .doors { display: flex; flex-direction: column; gap: 10px; }
  .door { text-align: left; border: 3px solid var(--ink); border-radius: var(--r); padding: 14px 18px; background: #fff; cursor: pointer; display: flex; flex-direction: column; gap: 2px; box-shadow: 4px 4px 0 var(--ink); transition: transform .08s, box-shadow .08s; }
  .door:hover:not(:disabled) { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 var(--ink); }
  .door:disabled { opacity: .5; cursor: not-allowed; }
  .door b { font-family: var(--f-pop); font-weight: 400; font-size: 24px; text-transform: uppercase; line-height: 1.1; }
  .door span { font-size: 14px; }
  .door.daily { background: var(--yellow); box-shadow: 5px 5px 0 var(--pink); }
  .door.friends { background: var(--blue); color: #fff; }
  .modes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .mode { text-align: left; border: 2px solid var(--ink); background: transparent; border-radius: 12px; padding: 8px 12px; cursor: pointer; display: flex; flex-direction: column; }
  .mode:hover { background: var(--paper-2); }
  .mode b { font-family: var(--f-pop); font-weight: 400; font-size: 16px; text-transform: uppercase; }
  .mode span { font-size: 12px; color: var(--ink-soft); }
  .off { font-size: 13px; color: var(--ink-soft); margin: 0; }
  .mapcol { display: flex; flex-direction: column; gap: 8px; }
  .legend { display: flex; gap: 8px; align-items: center; font-size: 12px; justify-content: flex-end; }
  .legend i { width: 14px; height: 14px; border: 2px solid var(--ink); display: inline-block; margin-left: 8px; }
  @media (max-width: 860px) { .home { grid-template-columns: 1fr; } }
</style>
