<script lang="ts">
  import { dep, DEPARTEMENTS, normalize, sameCode, sameName, type Answer, type ChoiceField, type Field, type InputMode, type Question, type RoundResult } from "@hexa/game";
  import Map, { type Mark } from "./Map.svelte";
  import Fiche from "./Fiche.svelte";
  import { onDestroy, type Snippet } from "svelte";
  import Mascot from "./ui/Mascot.svelte";
  import Icon from "./ui/Icon.svelte";
  import { sound } from "./sound.svelte.ts";

  interface Props {
    q: Question;
    /** Résultat du tour : quand il est fourni, on passe en correction. */
    result?: RoundResult | null;
    /** Instant de départ (performance.now()) du chrono. */
    startedAt: number;
    onsubmit: (a: Answer) => void;
    /** Bouton d'action affiché pendant la correction (Suivant…). */
    action?: Snippet;
    /** Contenu affiché sous la correction (classement du tour…). */
    children?: Snippet;
    /** Départements déjà joués dans la partie : restent colorés. */
    history?: Record<string, Mark>;
    /** Combo atteint avec ce tour (réponses parfaites d'affilée). */
    combo?: number;
    /** Façon de répondre, réglable en cours de partie (entraînement) : sinon déduite de la question. */
    answerMode?: InputMode;
    onmode?: (m: InputMode) => void;
  }
  let { q, result = null, startedAt, onsubmit, action, children, history = {}, combo = 0, answerMode, onmode }: Props = $props();
  /** Propositions affichées pour un champ (aucune en mode clavier). */
  const usesChoices = $derived(answerMode ? answerMode === "choix" : !!q.choices);
  const choicesOf = (f: ChoiceField) => (usesChoices ? q.choices?.[f] : undefined);
  const candidates = $derived(usesChoices && !result ? q.mapChoices : undefined);
  const timed = $derived(q.durationMs > 0);

  // Retour sonore et texte de la mascotte à l'arrivée du résultat.
  const PRAISE = ["Parfait !", "Bien joué !", "Imbattable.", "Ça, c'est du niveau préfet.", "Tu connais ta France !"];
  const feedback = $derived.by(() => {
    if (!result) return null;
    if (result.accuracy >= 0.999) return { mood: combo >= 5 ? "wow" : "happy", text: combo >= 3 ? `Combo ×${combo} ! ${PRAISE[combo % PRAISE.length]}` : PRAISE[q.index % PRAISE.length] } as const;
    if (q.tag === "new") return { mood: "think", text: `Maintenant tu sais ! On y revient en fin de séance.` } as const;
    if (result.accuracy > 0) return { mood: "think", text: `Presque ! ${Math.round(result.accuracy * 100)} % de bon, la correction est juste au-dessus.` } as const;
    return { mood: "sad", text: `Raté : ${d.nom} (${d.code}). Tu le retiendras !` } as const;
  });
  $effect(() => {
    if (!result) return;
    if (result.accuracy >= 0.999) sound.play(combo >= 3 ? "combo" : "ok", combo);
    else sound.play(result.accuracy > 0 || q.tag === "new" ? "partial" : "ko");
  });

  const d = $derived(dep(q.code));
  /** Comment désigner l'indice dans les consignes (« Place … sur la carte »). */
  const target = $derived(q.hint === "numero" ? `le ${d.code}` : q.hint === "prefecture" ? `le département de ${d.prefecture}` : d.nom);
  const has = (f: Field) => q.fields.includes(f);

  let sel = $state<string | null>(null);
  let near = $state<string[]>([]);
  let text = $state<Record<ChoiceField, string>>({ nom: "", numero: "", prefecture: "" });
  let sousPrefs = $state<string[]>([]);
  let spDraft = $state("");
  let submitted = $state(false);
  let nearDraft = $state("");
  let nearError = $state("");
  /** Valider sans avoir placé le département : on prévient une fois avant d'envoyer. */
  let nudge = $state(false);
  // Première rencontre : on montre d'abord la réponse (« À retenir »), puis on pose la question.
  // svelte-ignore state_referenced_locally
  /** Révision ou consolidation hors de la région en cours : on le dit, sinon la question semble tomber de nulle part. */
  const rev = $derived(q.tag === "review" ? "À revoir · " : "");
  const needsPlacing = $derived(!result && !submitted && has("carte") && !sel);

  // La carte ne sert qu'à placer le département ; les voisins se tapent (nom ou numéro).
  const mapTarget = $derived(has("carte") ? "carte" : null);

  /** Retrouve un département à partir d'un nom ou d'un numéro tapé. */
  function findDep(raw: string) {
    const v = raw.trim();
    if (!v) return null;
    // Exact d'abord (« Loiret » ne doit pas tomber sur « Loire »), puis tolérant aux fautes.
    return DEPARTEMENTS.find((x) => sameCode(v, x.code)) ?? DEPARTEMENTS.find((x) => normalize(x.nom) === normalize(v)) ?? DEPARTEMENTS.find((x) => sameName(v, x.nom)) ?? null;
  }
  function addNear() {
    const found = findDep(nearDraft);
    if (!found) { nearError = `« ${nearDraft.trim()} » : département introuvable`; return; }
    nearError = "";
    if (!near.includes(found.code)) near = [...near, found.code];
    nearDraft = "";
  }

  // ---- chrono ----
  let now = $state(performance.now());
  let raf = 0;
  const tick = () => { now = performance.now(); if (!result) raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  onDestroy(() => cancelAnimationFrame(raf));
  const remaining = $derived(timed ? Math.max(0, Math.min(q.durationMs, q.durationMs - (now - startedAt))) : 1);
  $effect(() => { if (timed && remaining <= 0 && !submitted && !result) submit(true); });

  function pick(code: string) {
    if (result || submitted) return;
    if (mapTarget === "carte") { sel = sel === code ? null : code; nudge = false; }
  }

  function addSousPref() {
    const v = spDraft.trim();
    if (v && !sousPrefs.includes(v)) sousPrefs = [...sousPrefs, v];
    spDraft = "";
  }

  function submit(force = false) {
    if (submitted || result) return;
    if (!force && needsPlacing && !nudge) {
      nudge = true;
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
      return;
    }
    if (spDraft.trim()) addSousPref();
    if (nearDraft.trim()) addNear();
    nearDraft = ""; nearError = "";
    submitted = true;
    const a: Answer = { elapsedMs: Math.round(performance.now() - startedAt) };
    if (has("carte")) a.carte = sel ?? undefined;
    if (has("nom")) a.nom = text.nom;
    if (has("numero")) a.numero = text.numero;
    if (has("prefecture")) a.prefecture = text.prefecture;
    if (has("sousPrefectures")) a.sousPrefectures = sousPrefs;
    if (has("limitrophes")) a.limitrophes = near;
    onsubmit(a);
  }

  const marks = $derived.by(() => {
    // Pendant qu'on place, on cache les départements déjà joués : sinon on trouve par élimination, et ils masqueraient le surlignage.
    const m: Record<string, Mark> = !result && has("carte") ? {} : { ...history };
    if (!result) {
      if (q.hint === "carte") m[q.code] = "hint";
      if (sel) m[sel] = "sel";
      return m;
    }
    if (has("limitrophes")) {
      for (const c of d.limitrophes) m[c] = near.includes(c) ? "ok" : "miss";
      for (const c of near) if (!d.limitrophes.includes(c)) m[c] = "ko";
    }
    if (has("carte")) {
      if (sel === q.code) m[q.code] = "ok";
      else { if (sel) m[sel] = "ko"; m[q.code] = "miss"; }
    } else m[q.code] = "ok";
    return m;
  });

  const fieldResult = (f: Field) => result?.fields.find((x) => x.field === f);
  const LABELS: Record<Field, string> = { carte: "Sur la carte", nom: "Nom", numero: "Numéro", prefecture: "Préfecture", sousPrefectures: "Sous-préfectures", limitrophes: "Voisins" };
  const PLACEHOLDER: Record<ChoiceField, string> = { nom: "Nom du département", numero: "Numéro", prefecture: "Préfecture" };
  const textFields = $derived((["nom", "numero", "prefecture"] as ChoiceField[]).filter(has));

  // Mobile + 4 propositions : une question à la fois, pour répondre sans faire défiler.
  let mobile = $state(typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches);
  $effect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const on = () => (mobile = mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  });
  const choiceFields = $derived(textFields.filter((f) => choicesOf(f)));
  const stepped = $derived(mobile && !result && choiceFields.length > 1);
  let step = $state(0);
  function choose(f: ChoiceField, opt: string) {
    text[f] = opt;
    if (!stepped) return;
    // Passe à la prochaine question sans réponse (dans l'ordre), sinon reste.
    const order = choiceFields;
    const next = order.findIndex((x, k) => k > order.indexOf(f) && !text[x]);
    const anyEmpty = order.findIndex((x) => !text[x]);
    if (next >= 0) step = next; else if (anyEmpty >= 0) step = anyEmpty;
  }

  function enter(e: KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = [...document.querySelectorAll<HTMLInputElement>(".round input:not([disabled])")];
    const idx = inputs.indexOf(e.currentTarget as HTMLInputElement);
    if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus();
    else submit();
  }
  function focusFirst(node: HTMLInputElement, first: boolean) { if (first && window.matchMedia("(pointer: fine)").matches) node.focus(); }
  function expectedLabel(f: Field, v: string | string[]) {
    if (f === "limitrophes" && Array.isArray(v)) return v.map((c) => `${dep(c).nom} (${c})`).join(", ");
    if (f === "carte") return `${d.nom} (${d.code})`;
    return Array.isArray(v) ? (v.length ? v.join(", ") : "aucune") : v;
  }
  const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const mapHelp = $derived(result ? "" : mapTarget !== "carte" ? "" : sel ? `Placé ! Tu peux changer en ${coarse ? "touchant" : "cliquant"} un autre département.` : coarse ? "Touche la région, puis le département. Pince pour zoomer." : "Clique le département sur la carte.");
</script>


<div class="round" class:review={!!result} class:placing={!result && mapTarget === "carte" && !sel} class:nudge={nudge && needsPlacing}>
  <div class="mapwrap">
    {#if mobile && !result && timed}
      <div class="timer top" aria-label="Temps restant">
        <div class="bar"><span style="transform:scaleX({remaining / q.durationMs})"></span></div>
        <span class="secs tabnum">{Math.ceil(remaining / 1000)} s</span>
      </div>
    {/if}
    <div class="maphead">
      {#if needsPlacing}
        {#key nudge}
          <div class="callout" class:nudge role="status">
            <Icon name="pin" size={18} />
            <span>{nudge ? "Tu n'as pas placé" : "Place"} <b>{target}</b>{nudge ? " !" : " sur la carte"}</span>
          </div>
        {/key}
        <span class="help sub">{candidates ? "Choisis parmi les 4 départements surlignés" : coarse ? "Touche la région, puis le département" : "Clique le département"}</span>
      {:else}
        <span class="help">{mapHelp}</span>
      {/if}
    </div>
    <Map {marks} interactive={!result && !!mapTarget} zoomable onpick={pick} {candidates} />
  </div>

  <section class="panel">
    <div class="timer" class:hidden={mobile || !timed} aria-label="Temps restant">
      <div class="bar"><span style="transform:scaleX({remaining / q.durationMs})"></span></div>
      <span class="secs tabnum">{result ? "" : Math.ceil(remaining / 1000) + " s"}</span>
    </div>

    <div class="clue" class:has-sw={!!(answerMode && onmode && !result)}>
      {#if answerMode && onmode && !result}
        <button class="modesw" onclick={() => onmode(answerMode === "choix" ? "libre" : "choix")} aria-label={answerMode === "choix" ? "Répondre au clavier" : "Répondre avec des propositions"}>
          {answerMode === "choix" ? "Au clavier" : "Propositions"}
        </button>
      {/if}
      {#if q.hint === "numero"}
        <span class="kicker">{rev}Le département numéro</span>
        <span class="riso bignum" data-t={d.code}>{d.code}</span>
      {:else if q.hint === "prefecture"}
        <span class="kicker">{rev}Le département de</span>
        <h2 class="qname">{d.prefecture}</h2>
      {:else if q.hint === "nom"}
        <span class="kicker">{q.tag === "new" ? "Nouveau · devine !" : q.tag === "home" ? "Chez toi" : q.tag === "review" ? "À revoir" : "Trouve"}</span>
        <h2 class="qname">{d.nom}</h2>
      {:else}
        <span class="kicker">{rev}Il clignote sur la carte</span>
        <h2 class="qname">Quel est ce département ?</h2>
      {/if}
    </div>

    <div class="fields">
      {#if has("carte")}
        {@const r = fieldResult("carte")}
        <div class="f carte" class:ok={r?.score === 1} class:ko={r && r.score < 1}>
          <span class="label">{LABELS.carte}</span>
          <span class="state">{#if r}{r.score === 1 ? "Bien placé" : "C'était " + expectedLabel("carte", r.expected)}{:else if sel}Placé ✓ <button class="link" onclick={() => (sel = null)}>Changer</button>{:else}<span class="todo" class:nudge><Icon name="pin" size={15} /> À placer sur la carte {mobile ? "↑" : "←"}</span>{/if}</span>
        </div>
      {/if}

      {#if stepped}
        <div class="steps" role="tablist" aria-label="Questions">
          {#each choiceFields as f, k (f)}
            <button role="tab" aria-selected={step === k} class="st" class:on={step === k} class:done={!!text[f]} onclick={() => (step = k)}>
              <span>{LABELS[f]}</span><b>{text[f] || "…"}</b>
            </button>
          {/each}
        </div>
      {/if}
      {#each textFields as f, i (f)}
        {@const r = fieldResult(f)}
        <div class="f" class:ok={r?.score === 1} class:ko={r && r.score < 1} class:hidden={stepped && !!choicesOf(f) && choiceFields.indexOf(f) !== step}>
          <label class="label" class:hidden={stepped && !!choicesOf(f)} for="in-{f}">{LABELS[f]}</label>
          {#if choicesOf(f)}
            <div class="choices" role="radiogroup" aria-label={LABELS[f]}>
              {#each choicesOf(f)! as opt (opt)}
                <button role="radio" aria-checked={text[f] === opt} class="opt" class:on={text[f] === opt}
                  class:right={r && opt === r.expected} class:wrong={r && text[f] === opt && opt !== r.expected}
                  disabled={!!result || submitted} onclick={() => choose(f, opt)}>{opt}</button>
              {/each}
            </div>
          {:else}
            <input id="in-{f}" class="field" autocomplete="off" autocapitalize={f === "numero" ? "characters" : "words"} spellcheck="false"
              inputmode={f === "numero" ? "text" : undefined}
              placeholder={PLACEHOLDER[f]} bind:value={text[f]} disabled={!!result || submitted} onkeydown={enter} use:focusFirst={i === 0} />
          {/if}
          {#if r && r.score < 1}<span class="exp">{expectedLabel(f, r.expected)}</span>{/if}
        </div>
      {/each}

      {#if has("sousPrefectures")}
        {@const r = fieldResult("sousPrefectures")}
        <div class="f" class:ok={r?.score === 1} class:ko={r && r.score < 1}>
          <label class="label" for="in-sp">{LABELS.sousPrefectures} · {d.sousPrefectures.length} à trouver</label>
          {#if sousPrefs.length}
            <div class="tags">{#each sousPrefs as s (s)}<button class="chip" disabled={!!result} onclick={() => (sousPrefs = sousPrefs.filter((x) => x !== s))}>{s} ×</button>{/each}</div>
          {/if}
          <input id="in-sp" class="field" autocomplete="off" spellcheck="false" placeholder="Une ville, puis Entrée"
            bind:value={spDraft} disabled={!!result || submitted}
            onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (spDraft.trim()) addSousPref(); else enter(e); } }} />
          {#if r && r.score < 1}<span class="exp">{expectedLabel("sousPrefectures", r.expected)}</span>{/if}
        </div>
      {/if}

      {#if has("limitrophes")}
        {@const r = fieldResult("limitrophes")}
        <div class="f" class:ok={r?.score === 1} class:ko={r && r.score < 1}>
          <label class="label" for="in-near">{LABELS.limitrophes} · {d.limitrophes.length} à trouver, nom ou numéro</label>
          {#if near.length}
            <div class="tags">{#each near as c (c)}<button class="chip" class:good={r && d.limitrophes.includes(c)} class:bad={r && !d.limitrophes.includes(c)} disabled={!!result} onclick={() => (near = near.filter((x) => x !== c))}>{dep(c).nom} ({c}){result ? "" : " ×"}</button>{/each}</div>
          {/if}
          <input id="in-near" class="field" autocomplete="off" spellcheck="false" placeholder="ex. Morbihan ou 56, puis Entrée"
            bind:value={nearDraft} disabled={!!result || submitted} oninput={() => (nearError = "")}
            onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (nearDraft.trim()) addNear(); else enter(e); } }} />
          {#if nearError}<span class="nerr">{nearError}</span>{/if}
          {#if r && r.score < 1}<span class="exp">{expectedLabel("limitrophes", r.expected)}</span>{/if}
        </div>
      {/if}
    </div>

    {#if result && feedback}
      <div class="react">
        <Mascot mood={feedback.mood} size={60} />
        <div class="bubble">{feedback.text}</div>
        <span class="pts tabnum" class:zero={result.points === 0}>+{result.points}</span>
      </div>
      <div class="fichebox"><Fiche code={q.code} expert={has("sousPrefectures") || has("limitrophes")} /></div>
      {@render children?.()}
    {/if}

    <div class="actions" class:v-ok={result && result.accuracy >= 0.999} class:v-mid={result && result.accuracy < 0.999 && (result.accuracy > 0 || q.tag === "new")} class:v-ko={result && result.accuracy === 0 && q.tag !== "new"}>
      {#if result && feedback}
        <!-- Mobile : verdict toujours visible dans la barre du bas, sans faire défiler -->
        <div class="verdict" aria-live="polite">
          <Mascot mood={feedback.mood} size={40} />
          <span class="vt"><b>{result.accuracy >= 0.999 ? (combo >= 3 ? `Combo ×${combo} !` : "Parfait !") : result.accuracy > 0 ? `Presque · ${Math.round(result.accuracy * 100)} %` : q.tag === "new" ? "Maintenant tu sais" : "Raté"}</b></span>
          <span class="vp tabnum">+{result.points}</span>
        </div>
        <ul class="recap" aria-label="Correction">
          {#each result.fields as f (f.field)}
            {@const good = f.score >= 0.999}
            <li class:good class:bad={!good}>
              <i class="dot"><Icon name={good ? "check" : "cross"} size={13} /></i>
              <span class="rl">{LABELS[f.field]}</span>
              <b class="ra">{expectedLabel(f.field, f.expected)}</b>
            </li>
          {/each}
        </ul>
      {/if}
      {#if !result}
        <button class="btn big" onclick={() => submit()} disabled={submitted}>{submitted ? "Envoyé" : nudge && needsPlacing ? "Valider sans placer" : "Valider"} <kbd>↵</kbd></button>
      {:else}
        {@render action?.()}
      {/if}
    </div>
  </section>
</div>

<style>
  .round { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(340px, 1fr); gap: 22px; align-items: start; }
  .mapwrap { position: sticky; top: 12px; display: flex; flex-direction: column; gap: 6px; }
  .clue { position: relative; }
  .clue.has-sw { padding-right: 118px; }
  .modesw { position: absolute; right: 0; top: 0; border: 0; background: var(--bg); color: var(--ink); font-weight: 800; font-size: 13px; padding: 6px 11px; border-radius: 999px; cursor: pointer; box-shadow: 0 2px 0 var(--line); z-index: 1; }
  .modesw:active { transform: translateY(2px); box-shadow: none; }
  .maphead { min-height: 38px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  /* Rappel « place-le sur la carte » : bulle jaune qui rebondit, rose et secouée si on valide sans placer */
  .callout { display: inline-flex; align-items: center; gap: 7px; background: var(--yellow); color: var(--ink); font-weight: 800; font-size: 16px; padding: 7px 13px 7px 10px; border-radius: 999px; box-shadow: 0 3px 0 var(--yellow-d); animation: pop-in .25s, bob 1.6s ease-in-out .3s infinite; }
  .callout b { font-weight: 900; }
  .callout.nudge { background: var(--pink); color: #fff; box-shadow: 0 3px 0 var(--pink-d); animation: shake .35s 2; }
  .help.sub { font-size: 13px; }
  .round.placing .mapwrap :global(.wrap) { border-radius: 20px; animation: ring 1.8s ease-in-out infinite; }
  .round.nudge .mapwrap :global(.wrap) { animation: ring-ko .9s ease-in-out 2; }
  .todo { display: inline-flex; align-items: center; gap: 5px; background: #fff4c2; color: var(--ink); font-weight: 800; padding: 3px 10px; border-radius: 999px; box-shadow: inset 0 0 0 2px var(--yellow); }
  .todo.nudge { background: #ffe1ef; box-shadow: inset 0 0 0 2px var(--pink); color: var(--pink-d); }
  @keyframes bob { 50% { transform: translateY(-3px); } }
  @keyframes ring { 0%, 100% { box-shadow: inset 0 0 0 0 rgba(255, 217, 61, 0); } 50% { box-shadow: inset 0 0 0 4px rgba(255, 217, 61, .9); } }
  @keyframes ring-ko { 50% { box-shadow: inset 0 0 0 4px var(--pink); } }
  .help { font-size: 15px; color: var(--soft); font-weight: 700; }
  .panel { display: flex; flex-direction: column; gap: 16px; background: var(--card); border-radius: 28px; padding: 22px 22px 18px; }
  .timer { display: flex; align-items: center; gap: 10px; }
  .bar { flex: 1; height: 10px; background: var(--bg-2); border-radius: 999px; overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--ink); border-radius: 999px; transform-origin: left; }
  .secs { font-size: 15px; font-weight: 800; min-width: 34px; text-align: right; }
  .clue { display: flex; flex-direction: column; gap: 2px; }
  .kicker { font-size: 14px; color: var(--soft); font-weight: 700; }
  .bignum { font-size: 104px; }
  .qname { font-size: clamp(28px, 3vw, 38px); font-weight: 900; text-transform: uppercase; line-height: 1.04; letter-spacing: -.01em; }
  .fields { display: flex; flex-direction: column; gap: 14px; }
  .f { display: flex; flex-direction: column; gap: 6px; }
  .state { font-weight: 700; }
  .f.ok .state, .f.ok .label { color: var(--blue); }
  .f.ko .label { color: var(--pink-d); }
  .exp { font-weight: 800; }
  .exp::before { content: "Réponse : "; color: var(--soft); font-weight: 600; }
  .choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .opt { font-weight: 700; font-size: 16px; line-height: 1.15; background: #f6f2ea; border: 0; border-radius: 14px; padding: 12px; text-align: left; cursor: pointer; box-shadow: 0 3px 0 #e2dacb; transition: transform .08s, background .1s; }
  @media (hover: hover) { .opt:hover:not(:disabled):not(.on) { background: #fff4c2; } }
  .opt:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 #e2dacb; }
  .opt.on { background: var(--ink); color: #fff; box-shadow: 0 3px 0 #000; }
  .opt.right { background: var(--blue); color: #fff; box-shadow: 0 3px 0 var(--blue-d); }
  .opt.wrong { background: var(--pink); color: #fff; box-shadow: 0 3px 0 var(--pink-d); animation: shake .35s; }
  .opt:disabled { cursor: default; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tags .chip.good { background: var(--blue); color: #fff; }
  .tags .chip.bad { background: var(--pink); color: #fff; }
  .nerr { color: var(--pink-d); font-weight: 700; font-size: 14px; animation: shake .3s; }
  .react { display: flex; align-items: center; gap: 12px; }
  .react .bubble { flex: 1; }
  .pts { font-family: var(--f-pop); font-size: 30px; color: var(--blue); animation: pop-in .4s cubic-bezier(.2, 1.6, .4, 1); }
  .pts.zero { color: var(--soft); }
  .actions { display: flex; gap: 12px; align-items: center; }
  .actions :global(.btn) { flex: 1; }

  .hidden { display: none !important; }
  .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .st { border: 0; border-radius: 12px; background: var(--bg); padding: 6px 8px; text-align: left; display: flex; flex-direction: column; cursor: pointer; min-width: 0; }
  .st span { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--soft); }
  .st b { font-size: 14px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .st.on { background: var(--ink); }
  .st.on span, .st.on b { color: #fff; }
  .st.done:not(.on) b { color: var(--blue); }
  .timer.top { padding: 4px 0 2px; }
  .verdict { display: none; }
  .recap { display: none; }
  @media (max-width: 900px) {
    /* Écran de jeu mobile « comme une appli » : carte en haut qui prend la place restante,
       panneau de réponses en bas (seul lui défile), barre d'action toujours visible. */
    .round { display: flex; flex-direction: column; align-items: stretch; gap: 6px; flex: 1; min-height: 0; width: 100%; }
    .panel, .mapwrap { width: auto; align-self: stretch; }
    .mapwrap { position: relative; top: 0; flex: 1 1 0; min-height: 150px; display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
    .panel { flex-shrink: 0; }
    .mapwrap :global(.wrap) { flex: 1; min-height: 0; display: flex; }
    .mapwrap :global(.map) { width: 100%; height: 100%; max-height: none; }
    .maphead { min-height: 0; }
    .help { font-size: 13px; }
    /* Le panneau prend la hauteur dont il a besoin ; la carte (zoomable) s'adapte au reste */
    .panel { flex: 0 1 auto; max-height: 74%; overflow-y: auto; overscroll-behavior: contain; margin: 0 -16px; padding: 12px 16px 0; border-radius: 22px 22px 0 0; gap: 10px; box-shadow: 0 -6px 18px -12px rgba(28, 26, 55, .3); }
    .mapwrap { min-height: 170px; }
    .clue { flex-direction: row; align-items: baseline; gap: 10px; flex-wrap: wrap; }
    .bignum { font-size: 40px; }
    .qname { font-size: 21px; }
    .kicker { font-size: 13px; }
    .fields { gap: 8px; }
    .f { gap: 4px; }
    /* « Sur la carte » sur une seule ligne */
    .f.carte { flex-direction: row; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .f.carte .state { font-size: 15px; }
    .st { padding: 4px 8px; }
    .st b { font-size: 13px; }
    .choices { gap: 6px; }
    .opt { padding: 9px 11px; font-size: 15px; }
    .actions { position: sticky; bottom: 0; z-index: 3; background: var(--card); margin: auto -16px 0; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); flex-wrap: wrap; gap: 8px; }
    /* À la correction, la fiche du bas suffit : on retire question, propositions et fiche détaillée
       (le classement d'un tour multijoueur, passé en enfant, reste visible) */
    .round.review .clue, .round.review .fields, .round.review .fichebox { display: none; }
    .round.review .panel { padding-top: 0; }
    /* Le verdict et la correction passent dans la barre du bas */
    .react { display: none; }
    .verdict { display: flex; align-items: center; gap: 10px; width: 100%; }
    .vt { flex: 1; display: flex; flex-direction: column; line-height: 1.15; }
    .vt b { font-weight: 900; font-size: 18px; }
    .vp { font-family: var(--f-pop); font-size: 26px; }
    /* Correction : une petite fiche blanche, une ligne par question (pastille ✓/✗, intitulé, bonne réponse) */
    .recap { list-style: none; margin: 0; padding: 4px 12px; width: 100%; background: #fff; border-radius: 16px; box-shadow: 0 3px 0 rgba(28, 26, 55, .1); display: flex; flex-direction: column; }
    .recap li { display: flex; align-items: center; gap: 8px; padding: 5px 0; min-width: 0; }
    .recap li + li { border-top: 2px solid var(--bg); }
    .dot { flex: none; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; color: #fff; }
    .good .dot { background: var(--blue); box-shadow: 0 2px 0 var(--blue-d); }
    .bad .dot { background: var(--pink); box-shadow: 0 2px 0 var(--pink-d); }
    .rl { flex: none; font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--soft); }
    .ra { flex: 1; min-width: 0; text-align: right; font-size: 14.5px; font-weight: 800; line-height: 1.2; }
    .good .ra { color: var(--blue-d); }
    .bad .ra { color: var(--ink); }
    /* Barre teintée aux couleurs du jeu selon le résultat */
    .actions.v-ok { background: var(--tint-ok); }
    .actions.v-ok .vt b, .actions.v-ok .vp { color: var(--blue-d); }
    .actions.v-mid { background: #fff1b8; }
    .actions.v-ko { background: var(--tint-ko); }
    .actions.v-ko .vt b, .actions.v-mid .vt b { color: var(--pink-d); }
  }
</style>
