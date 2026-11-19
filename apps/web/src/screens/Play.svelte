<script lang="ts">
  import FullscreenButton from "../lib/ui/FullscreenButton.svelte";
  import { ATLASES, TOUR, byFit, combos, difficulty, grade, makeGame, roundXp, updateSkill, type Answer, type Field, type InputMode, type RoundPlay, type RoundResult } from "@hexa/game";
  import Round from "../lib/Round.svelte";
  import type { Mark } from "../lib/Map.svelte";
  import Icon from "../lib/ui/Icon.svelte";
  import GameSheet from "../lib/ui/GameSheet.svelte";
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
    const input = play.config.switchable ? (usedChoices ? "choix" : "libre") : play.config.input;
    const rewards = profile.record({ mode: play.mode, level: play.config.level, input, results, region: play.region, now: Date.now(), learn: play.learn, rounds });
    // Statistiques anonymes : une partie solo terminée, par type.
    const e = play.mode === "seance" ? "seance" : play.mode === "marathon" ? "marathon" : play.mode === "apprendre" ? "revision" : "entrainement";
    fetch("/api/stats/event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ e }), keepalive: true }).catch(() => {});
    nav.go({ name: "results", play, questions, results, rewards, input });
  }
  /**
   * Séance Monde : après chaque découverte, le niveau est réévalué sur les réponses déjà données, et les découvertes
   * à venir trop faciles ou trop dures sont remplacées par des pays mieux ajustés (et leur rappel de fin de séance avec).
   */
  function adapt() {
    const t = updateSkill(profile.data.skill?.monde, results).t;
    const know = profile.data.know ?? {};
    const planned = new Set(questions.map((q) => q.code));
    const upcoming = questions.map((q, k) => ({ q, k })).filter(({ q, k }) => k > i && q.tag === "new");
    if (!upcoming.length) return;
    const pool = (TOUR.get(play.adapt!)?.deps ?? []).filter((c) => !planned.has(c) && !know[c]);
    const best = byFit(pool, t, Math.random);
    const target = t - 0.18, gap = (c: string) => Math.abs((difficulty(c) ?? 0.5) - target);
    let next = [...questions];
    for (const { q, k } of upcoming) {
      const c = best[0];
      if (!c || gap(q.code) - gap(c) < 0.15) continue; // assez bien ajusté : on garde
      best.shift();
      const ask = [...ATLASES.monde.base] as Field[];
      const [nq] = makeGame({ ...play.config, plan: [{ code: c, hint: "nom", ask, tag: "new" }] });
      const [nr] = makeGame({ ...play.config, plan: [{ code: c, hint: "nom", ask, recall: true }] });
      next = next.map((x, j) => (j === k ? { ...nq, index: k } : x.recall && x.code === q.code ? { ...nr, index: j } : x));
    }
    questions = next;
  }

  function next() {
    // Rappel de fin de séance inutile pour un département déjà réussi sans faute : on ne redemande pas ce que tu sais.
    const known = new Set(results.filter((r) => r.accuracy >= 0.999).map((r) => r.code));
    if (questions.some((x, k) => k > i && x.recall && known.has(x.code))) questions = questions.filter((x, k) => k <= i || !(x.recall && known.has(x.code)));
    // Un rappel qui tomberait juste après sa propre question (« Espagne » puis encore « Espagne ») ne rappelle rien :
    // on le saute, la répétition espacée le redemandera à la prochaine séance.
    if (questions[i + 1]?.recall && questions[i + 1].code === questions[i].code) questions = questions.filter((_, k) => k !== i + 1);
    if (play.adapt && questions[i].tag === "new") adapt();
    if (i + 1 >= questions.length) return finish();
    i += 1;
    result = null;
    startedAt = performance.now();
  }
  // Pause et « Quitter ? » : le chrono s'arrête (la question est cachée), et repart d'où il en était.
  let sheet = $state<null | "pause" | "quit">(null);
  let pausedAt = 0;
  function hold(kind: "pause" | "quit") {
    if (!sheet) pausedAt = performance.now();
    sheet = kind;
  }
  function resume() {
    if (!sheet) return;
    if (!result) startedAt += performance.now() - pausedAt;
    sheet = null;
  }
  function onkey(e: KeyboardEvent) {
    if (sheet || e.defaultPrevented) return;
    if (e.key === "Escape") { e.preventDefault(); hold("pause"); return; }
    if (result && e.key === "Enter" && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); next(); }
  }
  // Appli mise en arrière-plan (appel, notification…) : pause automatique plutôt qu'une question perdue.
  function onvisibility() { if (document.hidden && !result) hold("pause"); }
  function quit() {
    if (results.length && play.learn) progress.record(results);
    nav.go({ name: "home" });
  }
</script>

<svelte:window onkeydown={onkey} />
<svelte:document onvisibilitychange={onvisibility} />

<main class="play shell">
  <header>
    <button class="back" onclick={() => hold("quit")}>← Quitter</button>
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
    <button class="snd" onclick={() => hold("pause")} aria-label="Pause" title="Pause (Échap)"><Icon name="pause" /></button>
    <button class="snd" onclick={() => sound.toggle()} aria-label={sound.on ? "Couper le son" : "Activer le son"}><Icon name={sound.on ? "sound" : "mute"} /></button>
  </header>
  {#key i}
    <Round {q} {result} {startedAt} {history} combo={comboNow} onsubmit={submit} paused={!!sheet} km={result ? roundXp(result, comboNow) : undefined}
      answerMode={play.config.switchable ? answerMode : undefined} onmode={play.config.switchable ? setMode : undefined}>
      {#snippet action()}<button class="btn blue big" onclick={next}>{i + 1 >= questions.length ? "Voir mes récompenses" : "Suivant"} <kbd>↵</kbd></button>{/snippet}
    </Round>
  {/key}
</main>

{#if sheet === "pause"}
  <GameSheet title="Pause" mood="happy" primary="Reprendre" onprimary={resume} secondary="Quitter la partie" onsecondary={() => (sheet = "quit")}>
    <p>Question {i + 1} sur {questions.length}. La question est cachée, elle t'attend.</p>
  </GameSheet>
{:else if sheet === "quit"}
  <GameSheet title="Quitter la partie ?" mood="think" primary="Continuer à jouer" onprimary={resume} secondary="Quitter" onsecondary={quit}>
    {#if results.length}
      <p>Tu as répondu à {results.length} question{results.length > 1 ? "s" : ""} sur {questions.length}. {play.learn ? "Elles comptent pour tes révisions, mais" : "Si tu quittes,"} pas de kilomètres ni de récompenses pour cette partie.</p>
    {:else}
      <p>La partie vient de commencer : rien ne sera enregistré.</p>
    {/if}
  </GameSheet>
{/if}

<style>
  .play { max-width: 1320px; margin: 0 auto; padding: 12px 16px 24px; display: flex; flex-direction: column; gap: 12px; }
  header { display: flex; align-items: center; gap: 14px; }
  .dots { flex: 1; display: flex; gap: 4px; align-items: center; }
  .dots i { flex: 1; height: 9px; border-radius: 999px; background: #e3dccc; max-width: 48px; }
  .dots i.ok { background: var(--ok); }
  .dots i.ko { background: var(--ko); }
  .dots i.cur { background: var(--ink); }
  .long { flex: 1; height: 10px; background: #e3dccc; border-radius: 999px; overflow: hidden; }
  .long span { display: block; height: 100%; background: var(--blue); border-radius: 999px; }
  .combo { font-family: var(--f-pop); font-size: 20px; color: #fff; background: var(--pink); padding: 5px 11px; border-radius: 12px; box-shadow: 0 4px 0 var(--pink-d); transform: rotate(-3deg); animation: pop-in .35s cubic-bezier(.2, 1.6, .4, 1); }
  .snd { border: 0; background: #fff; width: 38px; height: 38px; border-radius: 999px; cursor: pointer; box-shadow: 0 3px 0 var(--line); display: grid; place-items: center; }
  /* Ordinateur : en-tête et partie forment un seul bloc, centré dans la fenêtre (comme l'accueil). Le haut est fixe
     (pas centré sur le contenu), sinon tout sauterait quand la correction allonge le panneau. */
  @media (min-width: 901px) { .play { min-height: 100dvh; gap: 18px; padding-top: max(24px, calc((100dvh - 840px) / 2)); } }
</style>
