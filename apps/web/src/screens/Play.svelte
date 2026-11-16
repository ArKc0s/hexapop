<script lang="ts">
  import { grade, makeGame, type Answer, type GameConfig, type RoundResult } from "@hexa/game";
  import Round from "../lib/Round.svelte";
  import { nav } from "../lib/nav.svelte.ts";
  import { progress } from "../lib/progress.svelte.ts";

  let { config, title, learn }: { config: GameConfig; title: string; learn: boolean } = $props();

  const questions = makeGame(config);
  let i = $state(0);
  let startedAt = $state(performance.now());
  let result = $state<RoundResult | null>(null);
  let results = $state<RoundResult[]>([]);
  const q = $derived(questions[i]);
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
    <span class="riso logo" data-t="HEXA">HEXA</span>
    <span class="chip">{title}</span>
    <span class="chip tabnum">{i + 1} / {questions.length}</span>
    <span class="score tabnum">{total} pts</span>
  </header>
  {#key i}
    <Round {q} {result} {startedAt} onsubmit={submit}>
      <button class="btn blue next" onclick={next}>{i + 1 >= questions.length ? "Voir le bilan" : "Suivant"} ↵</button>
    </Round>
  {/key}
</main>

<style>
  .play { max-width: 1320px; margin: 0 auto; padding: 14px 20px 40px; display: flex; flex-direction: column; gap: 14px; }
  header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .back { background: none; border: 0; cursor: pointer; font-weight: 600; padding: 0; }
  .logo { font-size: 28px; margin-right: auto; }
  .score { font-family: var(--f-pop); font-size: 22px; }
  .next { align-self: flex-start; }
</style>
