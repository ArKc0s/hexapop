<script lang="ts">
  import { dep, type Answer, type ChoiceField, type Field, type Question, type RoundResult } from "@hexa/game";
  import Map, { type Mark } from "./Map.svelte";
  import Fiche from "./Fiche.svelte";
  import { onDestroy } from "svelte";

  interface Props {
    q: Question;
    /** Résultat du tour : quand il est fourni, on passe en correction. */
    result?: RoundResult | null;
    /** Instant de départ (performance.now()) du chrono. */
    startedAt: number;
    onsubmit: (a: Answer) => void;
    /** Contenu affiché sous la correction (bouton suivant, classement…). */
    children?: import("svelte").Snippet;
    header?: import("svelte").Snippet;
    /** Départements déjà joués dans la partie : restent colorés. */
    history?: Record<string, Mark>;
  }
  let { q, result = null, startedAt, onsubmit, children, header, history = {} }: Props = $props();

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
  const remaining = $derived(Math.max(0, q.durationMs - (now - startedAt)));
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
    for (const f of result.fields) {
      if (f.field === "limitrophes") {
        for (const c of d.limitrophes) m[c] = near.includes(c) ? "ok" : "miss";
        for (const c of near) if (!d.limitrophes.includes(c)) m[c] = "ko";
      }
    }
    if (has("carte")) {
      if (sel === q.code) m[q.code] = "ok";
      else { if (sel) m[sel] = "ko"; m[q.code] = "miss"; }
    } else m[q.code] = "sel";
    return m;
  });

  const fieldResult = (f: Field) => result?.fields.find((x) => x.field === f);
  const LABELS: Record<Field, string> = { carte: "Sur la carte", nom: "Nom", numero: "Numéro", prefecture: "Préfecture", sousPrefectures: "Sous-préfectures", limitrophes: "Voisins" };
  const PLACEHOLDER: Record<ChoiceField, string> = { nom: "ex. Finistère", numero: "ex. 29", prefecture: "ex. Quimper" };
  const textFields = $derived((["nom", "numero", "prefecture"] as ChoiceField[]).filter(has));

  function enter(e: KeyboardEvent, i: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = [...document.querySelectorAll<HTMLInputElement>(".round input:not([disabled])")];
    const idx = inputs.indexOf(e.currentTarget as HTMLInputElement);
    if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus();
    else submit();
    void i;
  }
  function focusFirst(node: HTMLInputElement) { if (window.matchMedia("(pointer: fine)").matches) node.focus(); }
  function fmt(v: string | string[]) { return Array.isArray(v) ? (v.length ? v.join(", ") : "aucun") : v; }
  function expectedLabel(f: Field, v: string | string[]) {
    if (f === "limitrophes" && Array.isArray(v)) return v.map((c) => `${dep(c).nom} (${c})`).join(", ");
    if (f === "carte") return `${d.nom} (${d.code})`;
    return fmt(v);
  }
</script>

<div class="round">
  <div class="mapwrap" class:picking={!!mapTarget && !result}>
    {#if !result && has("carte") && has("limitrophes")}
      <div class="target" role="group" aria-label="Ce que tu cliques sur la carte">
        <button class="chip" class:on={mapTarget === "carte"} onclick={() => (manualTarget = "carte")}>Le département</button>
        <button class="chip" class:on={mapTarget === "limitrophes"} onclick={() => (manualTarget = "limitrophes")}>Ses voisins ({near.length}/{d.limitrophes.length})</button>
      </div>
    {/if}
    <Map {marks} interactive={!result && !!mapTarget} onpick={pick} />
  </div>

  <aside class="panel">
    {@render header?.()}
    <div class="clue">
      {#if q.hint === "numero"}
        <span class="riso num" data-t={d.code}>{d.code}</span>
      {:else if q.hint === "nom"}
        <span class="qname">{d.nom}</span>
      {:else}
        <span class="qname">Ce département qui clignote</span>
      {/if}
      <div class="timer" style="--p:{(remaining / q.durationMs) * 100}" aria-label="Temps restant">
        <span class="tabnum">{Math.ceil(remaining / 1000)}</span>
      </div>
    </div>

    <div class="fields">
      {#if has("carte")}
        {@const r = fieldResult("carte")}
        <div class="f" class:ok={r?.score === 1} class:ko={r && r.score < 1}>
          <span class="label">{LABELS.carte}</span>
          <span class="state">{#if r}{r.score === 1 ? "✓" : "✗ " + expectedLabel("carte", r.expected)}{:else}{sel ? "placé ✓" : "clique sur la carte"}{/if}</span>
        </div>
      {/if}

      {#each textFields as f, i (f)}
        {@const r = fieldResult(f)}
        <div class="f" class:ok={r?.score === 1} class:ko={r && r.score < 1}>
          <label class="label" for="in-{f}">{LABELS[f]}</label>
          {#if q.choices?.[f]}
            <div class="choices" role="radiogroup" aria-label={LABELS[f]}>
              {#each q.choices[f]! as opt (opt)}
                <button role="radio" aria-checked={text[f] === opt} class="choice" class:on={text[f] === opt}
                  class:right={r && opt === r.expected} disabled={!!result || submitted} onclick={() => (text[f] = opt)}>{opt}</button>
              {/each}
            </div>
          {:else}
            {#if i === 0}
              <input id="in-{f}" class="field" autocomplete="off" autocapitalize={f === "numero" ? "characters" : "words"} spellcheck="false"
                placeholder={PLACEHOLDER[f]} bind:value={text[f]} disabled={!!result || submitted} onkeydown={(e) => enter(e, i)} use:focusFirst />
            {:else}
              <input id="in-{f}" class="field" autocomplete="off" autocapitalize={f === "numero" ? "characters" : "words"} spellcheck="false"
                placeholder={PLACEHOLDER[f]} bind:value={text[f]} disabled={!!result || submitted} onkeydown={(e) => enter(e, i)} />
            {/if}
          {/if}
          {#if r && r.score < 1}<span class="exp">→ {expectedLabel(f, r.expected)}</span>{/if}
        </div>
      {/each}

      {#if has("sousPrefectures")}
        {@const r = fieldResult("sousPrefectures")}
        <div class="f" class:ok={r?.score === 1} class:ko={r && r.score < 1}>
          <label class="label" for="in-sp">{LABELS.sousPrefectures} · {d.sousPrefectures.length} à trouver</label>
          <div class="tags">
            {#each sousPrefs as s (s)}<button class="chip" disabled={!!result} onclick={() => (sousPrefs = sousPrefs.filter((x) => x !== s))}>{s} ×</button>{/each}
          </div>
          <input id="in-sp" class="field" autocomplete="off" spellcheck="false" placeholder="une ville puis Entrée"
            bind:value={spDraft} disabled={!!result || submitted}
            onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (spDraft.trim()) addSousPref(); else enter(e, 99); } }} />
          {#if r && r.score < 1}<span class="exp">→ {expectedLabel("sousPrefectures", r.expected)}</span>{/if}
        </div>
      {/if}

      {#if has("limitrophes")}
        {@const r = fieldResult("limitrophes")}
        <div class="f" class:ok={r?.score === 1} class:ko={r && r.score < 1}>
          <span class="label">{LABELS.limitrophes} · {d.limitrophes.length} à cliquer</span>
          <span class="state">{#if r}{r.score === 1 ? "✓ tous trouvés" : `${Math.round(r.score * 100)} %`}{:else}{near.length} sélectionné{near.length > 1 ? "s" : ""}{/if}</span>
        </div>
      {/if}
    </div>

    {#if !result}
      <button class="btn submit" onclick={submit} disabled={submitted}>{submitted ? "Envoyé…" : "Valider"}</button>
    {:else}
      <div class="gain"><span class="riso pts" data-t="+{result.points}">+{result.points}</span><span>{Math.round(result.accuracy * 100)} % juste · {(result.elapsedMs / 1000).toFixed(1)} s</span></div>
      <Fiche code={q.code} expert={q.fields.includes("sousPrefectures") || q.fields.includes("limitrophes")} />
      {@render children?.()}
    {/if}
  </aside>
</div>

<style>
  .round { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr); gap: 20px; align-items: start; }
  .mapwrap { position: sticky; top: 12px; display: flex; flex-direction: column; gap: 8px; }
  .target { display: flex; gap: 8px; flex-wrap: wrap; }
  .target .chip { cursor: pointer; }
  .panel { display: flex; flex-direction: column; gap: 16px; }
  .clue { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .num { font-size: 96px; }
  .qname { font-family: var(--f-pop); font-size: clamp(26px, 3.4vw, 38px); line-height: 1.02; text-transform: uppercase; text-wrap: balance; }
  .timer { flex: none; width: 72px; height: 72px; border-radius: 50%; border: 3px solid var(--ink); display: grid; place-items: center;
    background: conic-gradient(var(--pink) calc(var(--p) * 1%), transparent 0), var(--yellow); font-family: var(--f-pop); font-size: 24px; }
  .fields { display: flex; flex-direction: column; gap: 12px; }
  .f { display: flex; flex-direction: column; gap: 6px; padding-left: 10px; border-left: 4px solid transparent; }
  .f.ok { border-left-color: var(--blue); }
  .f.ko { border-left-color: var(--pink); }
  .state { font-weight: 600; }
  .exp { font-weight: 700; color: var(--blue); }
  .choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .choice { border: 2px solid var(--ink); border-radius: 10px; background: #fff; padding: 8px 10px; cursor: pointer; font-weight: 600; text-align: left; }
  .choice.on { background: var(--yellow); }
  .choice.right { background: var(--blue); color: #fff; }
  .choice:disabled { cursor: default; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tags .chip { cursor: pointer; background: #fff; }
  .submit { align-self: flex-start; }
  .gain { display: flex; align-items: baseline; gap: 12px; font-weight: 600; }
  .pts { font-size: 44px; }
  @media (max-width: 900px) {
    .round { grid-template-columns: 1fr; }
    .mapwrap { position: static; }
    .num { font-size: 64px; }
  }
</style>
