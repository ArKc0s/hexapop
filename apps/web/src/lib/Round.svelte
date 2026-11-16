<script lang="ts">
  import { dep, DEPARTEMENTS, normalize, sameCode, sameName, type Answer, type ChoiceField, type Field, type Question, type RoundResult } from "@hexa/game";
  import Map, { type Mark } from "./Map.svelte";
  import Fiche from "./Fiche.svelte";
  import { onDestroy, type Snippet } from "svelte";
  import Mascot from "./ui/Mascot.svelte";
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
  }
  let { q, result = null, startedAt, onsubmit, action, children, history = {}, combo = 0 }: Props = $props();

  // Retour sonore et texte de la mascotte à l'arrivée du résultat.
  const PRAISE = ["Parfait !", "Bien joué !", "Imbattable.", "Ça, c'est du niveau préfet.", "Tu connais ta France !"];
  const feedback = $derived.by(() => {
    if (!result) return null;
    if (result.accuracy >= 0.999) return { mood: combo >= 5 ? "wow" : "happy", text: combo >= 3 ? `Combo ×${combo} ! ${PRAISE[combo % PRAISE.length]}` : PRAISE[q.index % PRAISE.length] } as const;
    if (result.accuracy > 0) return { mood: "think", text: `Presque ! ${Math.round(result.accuracy * 100)} % de bon, la correction est juste au-dessus.` } as const;
    return { mood: "sad", text: `Raté : ${d.nom} (${d.code}). Tu le retiendras !` } as const;
  });
  $effect(() => {
    if (!result) return;
    if (result.accuracy >= 0.999) sound.play(combo >= 3 ? "combo" : "ok", combo);
    else sound.play(result.accuracy > 0 ? "partial" : "ko");
  });

  const d = $derived(dep(q.code));
  const has = (f: Field) => q.fields.includes(f);

  let sel = $state<string | null>(null);
  let near = $state<string[]>([]);
  let text = $state<Record<ChoiceField, string>>({ nom: "", numero: "", prefecture: "" });
  let sousPrefs = $state<string[]>([]);
  let spDraft = $state("");
  let submitted = $state(false);
  let nearDraft = $state("");
  let nearError = $state("");

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
  const remaining = $derived(Math.max(0, Math.min(q.durationMs, q.durationMs - (now - startedAt))));
  $effect(() => { if (remaining <= 0 && !submitted && !result) submit(); });

  function pick(code: string) {
    if (result || submitted) return;
    if (mapTarget === "carte") sel = sel === code ? null : code;
  }

  function addSousPref() {
    const v = spDraft.trim();
    if (v && !sousPrefs.includes(v)) sousPrefs = [...sousPrefs, v];
    spDraft = "";
  }

  function submit() {
    if (submitted || result) return;
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
    const m: Record<string, Mark> = { ...history };
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
  const choiceFields = $derived(textFields.filter((f) => q.choices?.[f]));
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

<div class="round" class:review={!!result} class:placing={!result && mapTarget === "carte" && !sel}>
  <div class="mapwrap">
    {#if mobile && !result}
      <div class="timer top" aria-label="Temps restant">
        <div class="bar"><span style="transform:scaleX({remaining / q.durationMs})"></span></div>
        <span class="secs tabnum">{Math.ceil(remaining / 1000)} s</span>
      </div>
    {/if}
    <div class="maphead">
      <span class="help">{mapHelp}</span>
    </div>
    <Map {marks} interactive={!result && !!mapTarget} zoomable onpick={pick} />
  </div>

  <section class="panel">
    <div class="timer" class:hidden={mobile} aria-label="Temps restant">
      <div class="bar"><span style="transform:scaleX({remaining / q.durationMs})"></span></div>
      <span class="secs tabnum">{result ? "" : Math.ceil(remaining / 1000) + " s"}</span>
    </div>

    <div class="clue">
      {#if q.hint === "numero"}
        <span class="kicker">Le département numéro</span>
        <span class="riso bignum" data-t={d.code}>{d.code}</span>
      {:else if q.hint === "nom"}
        <span class="kicker">Trouve</span>
        <h2 class="qname">{d.nom}</h2>
      {:else}
        <span class="kicker">Il clignote sur la carte</span>
        <h2 class="qname">Quel est ce département ?</h2>
      {/if}
    </div>

    <div class="fields">
      {#if has("carte")}
        {@const r = fieldResult("carte")}
        <div class="f" class:ok={r?.score === 1} class:ko={r && r.score < 1}>
          <span class="label">{LABELS.carte}</span>
          <span class="state">{#if r}{r.score === 1 ? "Bien placé" : "C'était " + expectedLabel("carte", r.expected)}{:else if sel}Placé ✓ <button class="link" onclick={() => (sel = null)}>Changer</button>{:else}À placer sur la carte{/if}</span>
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
        <div class="f" class:ok={r?.score === 1} class:ko={r && r.score < 1} class:hidden={stepped && q.choices?.[f] && choiceFields.indexOf(f) !== step}>
          <label class="label" class:hidden={stepped && !!q.choices?.[f]} for="in-{f}">{LABELS[f]}</label>
          {#if q.choices?.[f]}
            <div class="choices" role="radiogroup" aria-label={LABELS[f]}>
              {#each q.choices[f]! as opt (opt)}
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
      <Fiche code={q.code} expert={has("sousPrefectures") || has("limitrophes")} />
      {@render children?.()}
    {/if}

    <div class="actions" class:v-ok={result && result.accuracy >= 0.999} class:v-mid={result && result.accuracy > 0 && result.accuracy < 0.999} class:v-ko={result && result.accuracy === 0}>
      {#if result && feedback}
        <!-- Mobile : verdict toujours visible dans la barre du bas, sans faire défiler -->
        <div class="verdict" aria-live="polite">
          <Mascot mood={feedback.mood} size={40} />
          <span class="vt"><b>{result.accuracy >= 0.999 ? (combo >= 3 ? `Combo ×${combo} !` : "Parfait !") : result.accuracy > 0 ? `Presque · ${Math.round(result.accuracy * 100)} %` : "Raté"}</b>{#if result.accuracy < 0.999}<small>{d.nom} ({d.code})</small>{/if}</span>
          <span class="vp tabnum">+{result.points}</span>
        </div>
      {/if}
      {#if !result}
        <button class="btn big" onclick={submit} disabled={submitted}>{submitted ? "Envoyé" : "Valider"} <kbd>↵</kbd></button>
      {:else}
        {@render action?.()}
      {/if}
    </div>
  </section>
</div>

<style>
  .round { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(340px, 1fr); gap: 22px; align-items: start; }
  .mapwrap { position: sticky; top: 12px; display: flex; flex-direction: column; gap: 6px; }
  .maphead { min-height: 38px; display: flex; align-items: center; }
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
  .opt:hover:not(:disabled) { background: #fff4c2; }
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
  @media (max-width: 900px) {
    /* Le verdict passe dans la barre du bas ; le bloc mascotte du panneau devient inutile */
    .react { display: none; }
    .actions { flex-wrap: wrap; }
    .verdict { display: flex; align-items: center; gap: 10px; width: 100%; }
    .vt { flex: 1; display: flex; flex-direction: column; line-height: 1.15; }
    .vt b { font-weight: 900; font-size: 18px; }
    .vt small { font-weight: 700; font-size: 13px; opacity: .85; }
    .vp { font-family: var(--f-pop); font-size: 26px; }
    .actions.v-ok { background: #e3f0fb; }
    .actions.v-ok .vt b, .actions.v-ok .vp { color: var(--blue-d); }
    .actions.v-mid { background: #fff6cc; }
    .actions.v-ko { background: #ffe1ef; }
    .actions.v-ko .vt b { color: var(--pink-d); }
    .round { grid-template-columns: 1fr; gap: 10px; }
    .mapwrap { position: sticky; top: 0; z-index: 2; background: var(--bg); margin: 0 -16px; padding: 2px 16px 6px; }
    .mapwrap :global(.map) { max-height: 38vh; }
    /* Pendant qu'on place le département, la carte prend plus de place */
    .round.placing .mapwrap :global(.map) { max-height: 56vh; }
    .round.review .mapwrap { position: static; }
    .panel { padding: 16px; border-radius: 22px; }
    .bignum { font-size: 68px; }
    .qname { font-size: 26px; }
    .actions { position: sticky; bottom: 0; z-index: 3; background: var(--card); margin: 0 -16px -18px; padding: 10px 16px calc(12px + env(safe-area-inset-bottom)); border-radius: 22px 22px 0 0; box-shadow: 0 -6px 16px -10px rgba(28, 26, 55, .25); }
  }
</style>
