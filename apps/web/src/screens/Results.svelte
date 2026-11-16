<script lang="ts">
  import { dep, randomSeed, type GameConfig, type Question, type RoundResult } from "@hexa/game";
  import Map, { type Mark } from "../lib/Map.svelte";
  import Fiche from "../lib/Fiche.svelte";
  import { nav } from "../lib/nav.svelte.ts";

  let { config, title, questions, results, learn }: { config: GameConfig; title: string; questions: Question[]; results: RoundResult[]; learn: boolean } = $props();

  const total = results.reduce((n, r) => n + r.points, 0);
  const acc = results.reduce((n, r) => n + r.accuracy, 0) / Math.max(1, results.length);
  const perfect = results.filter((r) => r.accuracy >= 0.999).length;
  const missed = results.filter((r) => r.accuracy < 0.999);
  const marks: Record<string, Mark> = Object.fromEntries(results.map((r) => [r.code, r.accuracy >= 0.999 ? "ok" : r.accuracy >= 0.5 ? "sel" : "ko"]));
  let focus = $state<string | null>(missed[0]?.code ?? null);
  void questions;

  function replayMissed() {
    nav.go({ name: "play", config: { ...config, seed: randomSeed(), codes: missed.map((r) => r.code), rounds: undefined }, title: "Revanche", learn });
  }
</script>

<main class="res">
  <section class="sum">
    <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
    <h1 class="riso" data-t={String(total)}>{total}</h1>
    <p class="sub">points · {title}</p>
    <div class="stats">
      <div><b class="tabnum">{Math.round(acc * 100)} %</b><span>de bonnes réponses</span></div>
      <div><b class="tabnum">{perfect}/{results.length}</b><span>sans faute</span></div>
    </div>
    <div class="cta">
      {#if missed.length}<button class="btn accent" onclick={replayMissed}>Rejouer les {missed.length} ratés</button>{/if}
      <button class="btn ghost" onclick={() => nav.go({ name: "home" })}>Accueil</button>
    </div>
    {#if missed.length}
      <div class="label">À revoir</div>
      <div class="list">
        {#each missed as r (r.code)}
          <button class="chip" class:on={focus === r.code} onclick={() => (focus = r.code)}>{r.code} · {dep(r.code).nom}</button>
        {/each}
      </div>
      {#if focus}<Fiche code={focus} />{/if}
    {/if}
  </section>
  <section class="mapcol"><Map {marks} interactive onpick={(c) => (focus = c)} label="Bilan de la partie" /></section>
</main>

<style>
  .res { max-width: 1240px; margin: 0 auto; padding: 24px 20px 48px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: 28px; align-items: start; }
  .sum { display: flex; flex-direction: column; gap: 14px; }
  .back { align-self: flex-start; }
  h1 { font-size: clamp(72px, 11vw, 128px); margin: 0; }
  .sub { margin: -6px 0 0; font-weight: 600; }
  .stats { display: flex; gap: 28px; }
  .stats div { display: flex; flex-direction: column; }
  .stats b { font-family: var(--f-num); font-size: 28px; font-weight: 600; }
  .stats span { font-size: 13px; }
  .cta { display: flex; gap: 12px; flex-wrap: wrap; }
  .list { display: flex; flex-wrap: wrap; gap: 6px; }
  
  .mapcol { position: sticky; top: 12px; }
  @media (max-width: 860px) { .res { grid-template-columns: 1fr; } .mapcol { position: static; } }
</style>
