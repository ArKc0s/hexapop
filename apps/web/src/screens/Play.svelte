<script lang="ts">
  import { grade, makeGame, type Answer, type GameConfig, type RoundResult } from "@hexa/game";
  import Round from "../lib/Round.svelte";
  import type { Mark } from "../lib/Map.svelte";
  import { nav } from "../lib/nav.svelte.ts";
  import { progress } from "../lib/progress.svelte.ts";

  let { config, title, learn }: { config: GameConfig; title: string; learn: boolean } = $props();

  const questions = makeGame(config);
  let i = $state(0);
  let startedAt = $state(performance.now());
  let result = $state<RoundResult | null>(null);
  let results = $state<RoundResult[]>([]);
  const q = $derived(questions[i]);
  const history = $derived(Object.fromEntries(results.filter((r) => r !== result).map((r) => [r.code, (r.accuracy >= 0.999 ? "done-ok" : "done-ko") as Mark])));
  const total = $derived(results.reduce((n, r) => n + r.points, 0));

  function submit(a: Answer) {
    result = grade(q, a);
    results = [...results, result];
  }
  function next() {
    if (i + 1 >= questions.length) {
      if (learn) progress.record(results);
      nav.go({ name: "results", config, title, questions, results, learn });
      return;
    }
    i += 1;
    result = null;
    startedAt = performance.now();
  }
  function onkey(e: KeyboardEvent) {
    if (result && e.key === "Enter" && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); next(); }
  }
  function quit() {
    if (results.length && learn) progress.record(results);
    nav.go({ name: "home" });
  }
</script>

<svelte:window onkeydown={onkey} />

<main class="play">
  <header>
    <button class="back" onclick={quit}>← Quitter</button>
    <span class="display logo">HEXA</span>
    <span class="chip">{title}</span>
    <span class="chip tabnum">{i + 1} / {questions.length}</span>
    <span class="score tabnum">{total} pts</span>
  </header>
  {#key i}
    <Round {q} {result} {startedAt} {history} onsubmit={submit}>
      {#snippet action()}<button class="btn" onclick={next}>{i + 1 >= questions.length ? "Voir le bilan" : "Suivant"} <kbd>↵</kbd></button>{/snippet}
    </Round>
  {/key}
</main>

<style>
  .play { max-width: 1320px; margin: 0 auto; padding: 12px 16px 24px; display: flex; flex-direction: column; gap: 14px; }
  header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .back { background: none; border: 0; cursor: pointer; font-weight: 600; padding: 0; }
  .logo { font-size: 22px; margin-right: auto; color: var(--blue); }
  .score { font-family: var(--f-num); font-weight: 600; font-size: 18px; }
  @media (max-width: 600px) { header { gap: 8px; flex-wrap: nowrap; } header .chip:not(.warn) { display: none; } }
</style>
