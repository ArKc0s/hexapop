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
  <header>
    <h1 class="riso logo" data-t="HEXA">HEXA</h1>
    {#if session.me}
      <button class="link" onclick={() => nav.go({ name: "account", view: "profile" })}>{session.me.pseudo}</button>
    {:else if session.online}
      <button class="link" onclick={() => nav.go({ name: "account", view: "login" })}>Se connecter</button>
    {/if}
  </header>

  <section class="side">
    <p class="pitch">Les 101 départements, du 01 au 976. Où ils sont, leur numéro, leur préfecture.</p>

    <div class="rank">
      <div class="plate" aria-label="Ton rang : {rank.name}">
        <span class="band">F</span><span class="txt">{rank.name}</span><span class="band n num">{mastered}</span>
      </div>
      <span class="sub">{mastered} sur 101 maîtrisés{rank.next ? ` · encore ${rank.toNext} pour passer ${rank.next}` : ""}</span>
    </div>

    <button class="daily" disabled={!session.online} onclick={() => nav.go({ name: "daily" })}>
      <span class="kick">Défi du jour</span>
      <span class="big">10 départements, un seul essai</span>
      <span class="small">Les mêmes pour tout le monde. Compare ton score avec la France entière.</span>
    </button>

    <nav class="menu" aria-label="Modes de jeu">
      <button class="row" aria-expanded={soloOpen} onclick={() => (soloOpen = !soloOpen)}>
        <span><b>Jouer seul</b><small>Apprendre à ton rythme, ou enchaîner.</small></span><i>{soloOpen ? "−" : "+"}</i>
      </button>
      {#if soloOpen}
        <div class="sub-menu">
          <button onclick={() => nav.go({ name: "setup", mode: "apprendre" })}><b>Apprendre</b><small>12 départements choisis selon tes erreurs</small></button>
          <button onclick={() => nav.go({ name: "setup", mode: "eclair" })}><b>Éclair</b><small>20 au hasard</small></button>
          <button onclick={() => nav.go({ name: "setup", mode: "region" })}><b>Par région</b><small>une région en entier</small></button>
          <button onclick={() => nav.go({ name: "setup", mode: "marathon" })}><b>Marathon</b><small>les 101 d'affilée</small></button>
        </div>
      {/if}
      <button class="row" disabled={!session.online} onclick={() => nav.go({ name: "lobby" })}>
        <span><b>Avec des amis</b><small>Duel en direct, ou soirée jusqu'à 100 joueurs.</small></span><i>→</i>
      </button>
      <button class="row" onclick={() => nav.go({ name: "atlas" })}>
        <span><b>Atlas</b><small>Réviser la carte, fiche par fiche.</small></span><i>→</i>
      </button>
    </nav>
    {#if !session.online}<p class="off">Version de démonstration : le défi du jour et le multi ont besoin du serveur.</p>{/if}
  </section>

  <section class="mapcol" aria-label="Ta maîtrise sur la carte">
    <Map {fills} interactive={false} label="Carte de ta maîtrise des départements" />
    <div class="legend"><span><i style="background:#ffd0e7"></i>à revoir</span><span><i style="background:var(--yellow)"></i>en cours</span><span><i style="background:var(--blue)"></i>maîtrisé</span></div>
  </section>
</main>

<style>
  .home { max-width: 1280px; margin: 0 auto; padding: 18px 24px 48px; display: grid; grid-template-columns: minmax(300px, 420px) minmax(0, 1fr); gap: 8px 56px; }
  header { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; }
  .logo { font-size: 64px; margin: 0; }
  .side { display: flex; flex-direction: column; gap: 22px; padding-top: 12px; }
  .pitch { font-size: 20px; line-height: 1.35; margin: 0; font-weight: 500; }
  .rank { display: flex; flex-direction: column; gap: 6px; }
  .plate { display: inline-flex; align-self: flex-start; align-items: stretch; border: 2px solid var(--ink); border-radius: 6px; background: #fff; overflow: hidden; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
  .band { background: #1f4fa8; color: #fff; display: grid; place-items: center; padding: 4px 8px; font-size: 13px; }
  .band.n { font-size: 16px; min-width: 38px; }
  .txt { padding: 6px 14px; font-size: 20px; }
  .sub { font-size: 14px; color: var(--ink-soft); }
  .daily { text-align: left; border: 2px solid var(--ink); border-radius: var(--r); background: var(--yellow); padding: 16px 18px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; box-shadow: 4px 4px 0 var(--pink); transition: transform .08s, box-shadow .08s; }
  .daily:hover:not(:disabled) { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 var(--pink); }
  .daily:disabled { opacity: .45; cursor: not-allowed; }
  .kick { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
  .big { font-family: var(--f-pop); font-size: 24px; line-height: 1.05; text-transform: uppercase; }
  .small { font-size: 14px; }
  .menu { display: flex; flex-direction: column; border-top: 1.5px solid var(--ink); }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: none; border: 0; border-bottom: 1.5px solid var(--line); padding: 14px 2px; cursor: pointer; text-align: left; }
  .row:hover:not(:disabled) b { color: var(--blue); }
  .row:disabled { opacity: .4; cursor: not-allowed; }
  .row span { display: flex; flex-direction: column; }
  .row b { font-size: 19px; font-weight: 800; }
  .row small, .sub-menu small { font-size: 14px; color: var(--ink-soft); }
  .row i { font-style: normal; font-size: 22px; font-weight: 500; }
  .sub-menu { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; padding: 10px 0 14px 14px; border-bottom: 1.5px solid var(--line); }
  .sub-menu button { background: none; border: 0; text-align: left; padding: 6px 0; cursor: pointer; display: flex; flex-direction: column; }
  .sub-menu button:hover b { color: var(--blue); }
  .sub-menu b { font-weight: 700; }
  .off { font-size: 13px; color: var(--ink-soft); margin: 0; }
  .mapcol { display: flex; flex-direction: column; gap: 6px; }
  .legend { display: flex; gap: 16px; font-size: 13px; color: var(--ink-soft); justify-content: flex-end; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend i { width: 12px; height: 12px; border-radius: 3px; border: 1px solid var(--ink); display: inline-block; }
  @media (max-width: 860px) {
    .home { grid-template-columns: 1fr; padding: 14px 16px 40px; }
    .logo { font-size: 48px; }
    .pitch { font-size: 18px; }
    .sub-menu { grid-template-columns: 1fr; }
  }
  @media (min-width: 861px) { .home { min-height: 100dvh; align-content: center; } }
</style>
