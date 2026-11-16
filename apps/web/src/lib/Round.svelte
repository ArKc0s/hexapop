<script lang="ts">
  import { dep, type Answer, type ChoiceField, type Field, type Question, type RoundResult } from "@hexa/game";
  import Map, { type Mark } from "./Map.svelte";
  import Fiche from "./Fiche.svelte";
  import { onDestroy, type Snippet } from "svelte";

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
  }
  let { q, result = null, startedAt, onsubmit, action, children, history = {} }: Props = $props();

  const d = $derived(dep(q.code));
  const has = (f: Field) => q.fields.includes(f);

  let sel = $state<string | null>(null);
  let near = $state<string[]>([]);
  let text = $state<Record<ChoiceField, string>>({ nom: "", numero: "", prefecture: "" });
  let sousPrefs = $state<string[]>([]);
  let spDraft = $state("");
  let submitted = $state(false);
  let manualTarget = $state<"carte" | "limitrophes" | null>(null);

  const mapTarget = $derived.by(() => {
    if (manualTarget) return manualTarget;
    if (has("carte") && !sel) return "carte";
    if (has("limitrophes")) return "limitrophes";
    return has("carte") ? "carte" : null;
  });

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
    if (mapTarget === "carte") { sel = sel === code ? null : code; manualTarget = null; return; }
    if (mapTarget === "limitrophes") {
      const self = q.hint === "carte" ? q.code : sel;
      if (code === self) return;
      near = near.includes(code) ? near.filter((c) => c !== code) : [...near, code];
    }
  }

  function addSousPref() {
    const v = spDraft.trim();
    if (v && !sousPrefs.includes(v)) sousPrefs = [...sousPrefs, v];
    spDraft = "";
  }

  function submit() {
    if (submitted || result) return;
    if (spDraft.trim()) addSousPref();
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
      for (const c of near) m[c] = "near";
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
  const mapHelp = $derived(
    result ? "" : mapTarget === "carte" ? "Touche le département sur la carte" : mapTarget === "limitrophes" ? `Touche ses ${d.limitrophes.length} voisins` : "",
  );
</script>

<div class="round" class:review={!!result}>
  <div class="mapwrap">
    <div class="maphead">
      {#if !result && has("carte") && has("limitrophes")}
        <div class="seg" role="group" aria-label="Ce que tu touches sur la carte">
          <button class:on={mapTarget === "carte"} onclick={() => (manualTarget = "carte")}>Le département {sel ? "✓" : ""}</button>
          <button class:on={mapTarget === "limitrophes"} onclick={() => (manualTarget = "limitrophes")}>Ses voisins · {near.length}/{d.limitrophes.length}</button>
        </div>
      {:else}
        <span class="help">{mapHelp}</span>
      {/if}
    </div>
    <Map {marks} interactive={!result && !!mapTarget} onpick={pick} />
  </div>

  <section class="panel">
    <div class="timer" aria-label="Temps restant">
      <div class="bar"><span style="transform:scaleX({remaining / q.durationMs})"></span></div>
      <span class="num secs">{result ? "–" : Math.ceil(remaining / 1000) + " s"}</span>
    </div>

    <div class="clue">
      {#if q.hint === "numero"}
        <span class="kicker">Le département numéro</span>
        <span class="riso bignum" data-t={d.code}>{d.code}</span>
      {:else if q.hint === "nom"}
        <span class="kicker">Trouve</span>
        <h2 class="display qname">{d.nom}</h2>
      {:else}
        <span class="kicker">Il clignote sur la carte</span>
        <h2 class="display qname">Quel est ce département ?</h2>
      {/if}
    </div>

    <div class="fields">
      {#if has("carte")}
        {@const r = fieldResult("carte")}
        <div class="f" class:ok={r?.score === 1} class:ko={r && r.score < 1}>
          <span class="label">{LABELS.carte}</span>
          <span class="state">{#if r}{r.score === 1 ? "Bien placé" : "C'était " + expectedLabel("carte", r.expected)}{:else}{sel ? "Placé" : "À placer sur la carte"}{/if}</span>
        </div>
      {/if}

      {#each textFields as f, i (f)}
        {@const r = fieldResult(f)}
        <div class="f" class:ok={r?.score === 1} class:ko={r && r.score < 1}>
          <label class="label" for="in-{f}">{LABELS[f]}</label>
          {#if q.choices?.[f]}
            <div class="choices" role="radiogroup" aria-label={LABELS[f]}>
              {#each q.choices[f]! as opt (opt)}
                <button role="radio" aria-checked={text[f] === opt} class="opt" class:on={text[f] === opt}
                  class:right={r && opt === r.expected} class:wrong={r && text[f] === opt && opt !== r.expected}
                  disabled={!!result || submitted} onclick={() => (text[f] = opt)}>{opt}</button>
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
          <span class="label">{LABELS.limitrophes} · {d.limitrophes.length} à toucher</span>
          <span class="state">{#if r}{r.score === 1 ? "Tous trouvés" : `${Math.round(r.score * 100)} % · ${expectedLabel("limitrophes", r.expected)}`}{:else}{near.length} sélectionné{near.length > 1 ? "s" : ""}{/if}</span>
        </div>
      {/if}
    </div>

    {#if result}
      <div class="gain">
        <span class="display pts num">+{result.points}</span>
        <span>{Math.round(result.accuracy * 100)} % juste · {(result.elapsedMs / 1000).toFixed(1)} s</span>
      </div>
      <Fiche code={q.code} expert={has("sousPrefectures") || has("limitrophes")} />
      {@render children?.()}
    {/if}

    <div class="actions">
      {#if !result}
        <button class="btn accent" onclick={submit} disabled={submitted}>{submitted ? "Envoyé" : "Valider"} <kbd>↵</kbd></button>
      {:else}
        {@render action?.()}
      {/if}
    </div>
  </section>
</div>

<style>
  .round { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(320px, 1fr); gap: 28px; align-items: start; }
  .mapwrap { position: sticky; top: 12px; display: flex; flex-direction: column; gap: 6px; }
  .maphead { min-height: 34px; display: flex; align-items: center; }
  .help { font-size: 14px; color: var(--ink-soft); font-weight: 500; }
  .panel { display: flex; flex-direction: column; gap: 18px; }
  .timer { display: flex; align-items: center; gap: 10px; }
  .bar { flex: 1; height: 6px; background: var(--paper-2); border-radius: 3px; overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--ink); transform-origin: left; }
  .secs { font-size: 13px; color: var(--ink-soft); min-width: 34px; text-align: right; }
  .clue { display: flex; flex-direction: column; gap: 4px; }
  .kicker { font-size: 14px; color: var(--ink-soft); font-weight: 600; }
  .bignum { font-size: 112px; }
  .qname { font-size: clamp(28px, 3.2vw, 40px); text-transform: uppercase; line-height: 1.12; }
  .fields { display: flex; flex-direction: column; gap: 16px; }
  .f { display: flex; flex-direction: column; gap: 6px; }
  .state { font-weight: 600; }
  .f.ok .state, .f.ok .label { color: var(--blue); }
  .f.ko .label { color: #b0005f; }
  .exp { font-weight: 600; color: var(--ink); }
  .exp::before { content: "Réponse : "; color: var(--ink-soft); font-weight: 500; }
  .choices { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .opt { border: 1.5px solid var(--line); border-radius: 8px; background: var(--card); padding: 9px 12px; cursor: pointer; font-weight: 600; text-align: left; transition: border-color .1s; }
  .opt:hover:not(:disabled) { border-color: var(--ink); }
  .opt.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .opt.right { background: var(--blue); color: #fff; border-color: var(--blue); }
  .opt.wrong { background: var(--ko); color: #fff; border-color: var(--ko); }
  .opt:disabled { cursor: default; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .gain { display: flex; align-items: baseline; gap: 12px; font-weight: 600; color: var(--ink-soft); }
  .pts { font-size: 40px; color: var(--ink); }
  .actions { display: flex; gap: 12px; align-items: center; }
  .actions :global(.btn) { min-width: 140px; justify-content: center; }

  @media (max-width: 900px) {
    .round { grid-template-columns: 1fr; gap: 12px; }
    .mapwrap { position: sticky; top: 0; z-index: 2; background: var(--paper); margin: 0 -16px; padding: 4px 16px 6px; border-bottom: 1px solid var(--line); }
    .mapwrap :global(.map) { max-height: 40vh; }
    .round.review .mapwrap { position: static; }
    .bignum { font-size: 72px; }
    .qname { font-size: 26px; }
    .actions { position: sticky; bottom: 0; z-index: 3; background: var(--paper); margin: 0 -16px; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); border-top: 1px solid var(--line); }
    .actions :global(.btn) { flex: 1; }
  }
</style>
