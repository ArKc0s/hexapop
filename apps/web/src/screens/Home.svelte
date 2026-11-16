<script lang="ts">
  import { DEPARTEMENTS, mastery } from "@hexa/game";
  import Map from "../lib/Map.svelte";
  import { nav } from "../lib/nav.svelte.ts";
  import { progress } from "../lib/progress.svelte.ts";
  import { masteryFills } from "../lib/mastery.ts";

  const all = DEPARTEMENTS.map((d) => d.code);
  const mastered = $derived(mastery(progress.data, all));
  const seen = $derived(Object.keys(progress.data).length);
  const fills = $derived(masteryFills(progress.data));
</script>

<main class="home">
  <section class="hero">
    <h1 class="riso logo" data-t="HEXA">HEXA</h1>
    <p class="pitch">101 départements, leurs numéros, leurs préfectures. Pars de zéro, finis incollable, puis défie tes potes.</p>
    <div class="score">
      <span class="big tabnum">{mastered}</span><span class="of">/ 101 maîtrisés</span>
      <span class="chip">{seen} déjà croisés</span>
    </div>
    <div class="cta">
      <button class="btn" onclick={() => nav.go({ name: "setup", mode: "apprendre" })}>Apprendre</button>
      <button class="btn blue" disabled title="Arrive avec le serveur">Défier des amis</button>
    </div>
    <div class="modes">
      <button class="mode" onclick={() => nav.go({ name: "setup", mode: "eclair" })}><b>Éclair</b><span>20 départements au hasard</span></button>
      <button class="mode" onclick={() => nav.go({ name: "setup", mode: "region" })}><b>Par région</b><span>une région à fond</span></button>
      <button class="mode" onclick={() => nav.go({ name: "setup", mode: "marathon" })}><b>Marathon</b><span>les 101, sans pitié</span></button>
      <button class="mode" onclick={() => nav.go({ name: "atlas" })}><b>Atlas</b><span>réviser la carte</span></button>
    </div>
  </section>
  <section class="mapcol" aria-label="Ta maîtrise sur la carte">
    <Map fills={fills} tints={false} interactive={false} label="Carte de ta maîtrise des départements" />
    <div class="legend"><i style="background:var(--tint-a)"></i>à revoir <i style="background:var(--yellow)"></i>en cours <i style="background:var(--blue)"></i>maîtrisé</div>
  </section>
</main>

<style>
  .home { max-width: 1240px; margin: 0 auto; padding: 32px 20px 48px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 32px; align-items: center; min-height: 100vh; }
  .hero { display: flex; flex-direction: column; gap: 22px; }
  .logo { font-size: clamp(72px, 12vw, 140px); margin: 0; letter-spacing: .01em; }
  .pitch { font-size: 18px; max-width: 34ch; margin: 0; }
  .score { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .big { font-family: var(--f-pop); font-size: 56px; line-height: 1; }
  .of { font-weight: 600; }
  .cta { display: flex; gap: 14px; flex-wrap: wrap; }
  .modes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .mode { text-align: left; border: 2px solid var(--ink); background: transparent; border-radius: 12px; padding: 10px 14px; cursor: pointer; display: flex; flex-direction: column; }
  .mode:hover { background: var(--paper-2); }
  .mode b { font-family: var(--f-pop); font-weight: 400; font-size: 17px; text-transform: uppercase; }
  .mode span { font-size: 13px; color: var(--ink-soft); }
  .mapcol { display: flex; flex-direction: column; gap: 8px; }
  .legend { display: flex; gap: 8px; align-items: center; font-size: 12px; justify-content: flex-end; }
  .legend i { width: 14px; height: 14px; border: 2px solid var(--ink); display: inline-block; margin-left: 8px; }
  @media (max-width: 860px) { .home { grid-template-columns: 1fr; min-height: 0; } }
</style>
