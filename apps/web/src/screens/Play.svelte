<script lang="ts">
  import FullscreenButton from "../lib/ui/FullscreenButton.svelte";
  import { combos, grade, makeGame, type Answer, type Field, type InputMode, type RoundPlay, type RoundResult } from "@hexa/game";
  import Round from "../lib/Round.svelte";
  import type { Mark } from "../lib/Map.svelte";
  import Icon from "../lib/ui/Icon.svelte";
  import { nav, type PlayScreen } from "../lib/nav.svelte.ts";
  import { progress } from "../lib/progress.svelte.ts";
  import { profile } from "../lib/profile.svelte.ts";
  import { sound } from "../lib/sound.svelte.ts";

  let props: Omit<PlayScreen, "name"> = $props();
  // svelte-ignore state_referenced_locally
  const play: PlayScreen = { name: "play", ...props };

  let questions = $state(makeGame(play.config));
  let i = $state(0);
  let startedAt = $state(performance.now());
  let result = $state<RoundResult | null>(null);
  let results = $state<RoundResult[]>([]);
  const q = $derived(questions[i]);
  const history = $derived(Object.fromEntries(results.filter((r) => r !== result).map((r) => [r.code, (r.accuracy >= 0.999 ? "done-ok" : "done-ko") as Mark])));
  const comboNow = $derived(combos(results).at(-1) ?? 0);

  // Entraînement : propositions ou clavier, changeable à tout moment et mémorisé.
  const MODE_KEY = "hexa.answerMode";
  const savedMode = (() => { try { return localStorage.getItem(MODE_KEY); } catch { return null; } })();
  let answerMode = $state<InputMode>(savedMode === "choix" || savedMode === "libre" ? savedMode : play.config.input);
  let usedChoices = false;
  function setMode(m: InputMode) {
    answerMode = m;
    try { localStorage.setItem(MODE_KEY, m); } catch { /* navigation privée */ }
  }

  /** Pour les étoiles : l'indice, les champs, et ceux répondus avec de l'aide (propositions, carte à 4 choix). */
  const rounds: RoundPlay[] = [];
  function submit(a: Answer) {
    if (answerMode === "choix") usedChoices = true;
    // Seules les propositions faciles (première rencontre) ne comptent que comme « vues » ; les autres font gagner l'étoile.
    const helped = (play.config.switchable ? answerMode === "choix" : play.config.input === "choix") && !!q.easy;
    const aided = helped ? q.fields.filter((f: Field) => (f === "carte" ? !!q.mapChoices : !!q.choices?.[f as "nom"])) : [];
    rounds.push({ hint: q.hint, fields: q.fields, aided });
    result = grade(q, a);
    results = [...results, result];
  }
  function finish() {
    if (play.learn) progress.record(results);
    const rewards = profile.record({ mode: play.mode, level: play.config.level, input: play.config.switchable ? (usedChoices ? "choix" : "libre") : play.config.input, results, region: play.region, now: Date.now(), learn: play.learn, rounds });
    nav.go({ name: "results", play, questions, results, rewards });
  }
  function next() {
    // Rappel de fin de séance inutile pour un département déjà réussi sans faute : on ne redemande pas ce que tu sais.
    const known = new Set(results.filter((r) => r.accuracy >= 0.999).map((r) => r.code));
    if (questions.some((x, k) => k > i && x.recall && known.has(x.code))) questions = questions.filter((x, k) => k <= i || !(x.recall && known.has(x.code)));
    if (i + 1 >= questions.length) return finish();
    i += 1;
    result = null;
    startedAt = performance.now();
  }
  function onkey(e: KeyboardEvent) {
    if (result && e.key === "Enter" && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); next(); }
  }
  function quit() {
    if (results.length && play.learn) progress.record(results);
    nav.go({ name: "home" });
  }
</script>

<svelte:window onkeydown={onkey} />

<main class="play shell">
  <header>
    <button class="back" onclick={quit}>← Quitter</button>
    <div class="dots" aria-label="Tour {i + 1} sur {questions.length}">
      {#if questions.length <= 30}
        {#each questions as _, k (k)}
          <i class:ok={results[k]?.accuracy >= 0.999} class:ko={results[k] && results[k].accuracy < 0.999} class:cur={k === i && !result}></i>
        {/each}
      {:else}
        <div class="long"><span style="width:{(results.length / questions.length) * 100}%"></span></div>
        <b class="tabnum">{i + 1}/{questions.length}</b>
      {/if}
    </div>
    {#if comboNow >= 2}<span class="combo" aria-label="Combo">×{comboNow}</span>{/if}
    <FullscreenButton />
    <button class="snd" onclick={() => sound.toggle()} aria-label={sound.on ? "Couper le son" : "Activer le son"}><Icon name={sound.on ? "sound" : "mute"} /></button>
  </header>
  {#key i}
    <Round {q} {result} {startedAt} {history} combo={comboNow} onsubmit={submit}
      answerMode={play.config.switchable ? answerMode : undefined} onmode={play.config.switchable ? setMode : undefined}>
      {#snippet action()}<button class="btn blue big" onclick={next}>{i + 1 >= questions.length ? "Voir mes récompenses" : "Suivant"} <kbd>↵</kbd></button>{/snippet}
    </Round>
  {/key}
</main>

<style>
  .play { max-width: 1320px; margin: 0 auto; padding: 12px 16px 24px; display: flex; flex-direction: column; gap: 12px; }
  header { display: flex; align-items: center; gap: 14px; }
  .dots { flex: 1; display: flex; gap: 4px; align-items: center; }
  .dots i { flex: 1; height: 9px; border-radius: 999px; background: #e3dccc; max-width: 48px; }
  .dots i.ok { background: var(--blue); }
  .dots i.ko { background: var(--pink); }
  .dots i.cur { background: var(--ink); }
  .long { flex: 1; height: 10px; background: #e3dccc; border-radius: 999px; overflow: hidden; }
  .long span { display: block; height: 100%; background: var(--blue); border-radius: 999px; }
  .combo { font-family: var(--f-pop); font-size: 20px; color: #fff; background: var(--pink); padding: 5px 11px; border-radius: 12px; box-shadow: 0 4px 0 var(--pink-d); transform: rotate(-3deg); animation: pop-in .35s cubic-bezier(.2, 1.6, .4, 1); }
  .snd { border: 0; background: #fff; width: 38px; height: 38px; border-radius: 12px; cursor: pointer; box-shadow: 0 3px 0 var(--line); display: grid; place-items: center; }
  @media (min-width: 901px) { .play { min-height: 100dvh; } .play > :global(.round) { flex: 1; align-content: center; } }
</style>
