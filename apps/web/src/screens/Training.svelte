<script lang="ts">
  import { DEPARTEMENTS, REGIONS, playable, randomSeed, type Field, type GameConfig, type GameMode, type Hint, type InputMode } from "@hexa/game";
  import { nav } from "../lib/nav.svelte.ts";
  import Mascot from "../lib/ui/Mascot.svelte";
  import { previewSeance, startSeance } from "../lib/seance.svelte.ts";

  /** Révisions dues : la même séance que celle proposée sur l'accueil. */
  const due = previewSeance("revision").reviews;

  // ---------- options ----------
  type Zone = "france" | "region" | "om";
  const GIVE: { id: Hint; label: string }[] = [
    { id: "nom", label: "Le nom" },
    { id: "carte", label: "La carte" },
    { id: "numero", label: "Le numéro" },
    { id: "prefecture", label: "La préfecture" },
  ];
  const ASK: { id: Field; label: string; expert?: boolean }[] = [
    { id: "carte", label: "Le placer" },
    { id: "nom", label: "Le nom" },
    { id: "numero", label: "Le numéro" },
    { id: "prefecture", label: "La préfecture" },
    { id: "sousPrefectures", label: "Les sous-préfectures", expert: true },
    { id: "limitrophes", label: "Les voisins", expert: true },
  ];
  const PRESETS: { nom: string; desc: string; give: Hint[]; ask: Field[] }[] = [
    { nom: "Apprendre la carte", desc: "On te donne le nom, tu le places", give: ["nom"], ask: ["carte"] },
    { nom: "Les numéros", desc: "Nom ou carte → numéro", give: ["nom", "carte"], ask: ["numero"] },
    { nom: "Les préfectures", desc: "Nom ou carte → préfecture", give: ["nom", "carte"], ask: ["prefecture"] },
    { nom: "Fiche complète", desc: "Tout à la fois, le « à moitié bon » compte", give: ["nom", "numero", "carte"], ask: ["carte", "nom", "numero", "prefecture"] },
    { nom: "Expert", desc: "Sous-préfectures et voisins", give: ["nom", "carte"], ask: ["sousPrefectures", "limitrophes"] },
  ];
  const METRO_REGIONS = REGIONS.filter((r) => DEPARTEMENTS.some((d) => d.region === r.code && !d.outreMer));

  // ---------- réglages (mémorisés) ----------
  const KEY = "hexa.training";
  interface Settings { zone: Zone; region: string; give: Hint[]; ask: Field[]; length: number | "all"; input: InputMode }
  const DEFAULTS: Settings = { zone: "france", region: METRO_REGIONS[0].code, give: ["nom"], ask: ["carte"], length: 10, input: "choix" };
  function load(): Settings {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Settings> | null;
      if (!s) return DEFAULTS;
      return {
        zone: s.zone === "region" || s.zone === "om" ? s.zone : "france",
        region: METRO_REGIONS.some((r) => r.code === s.region) ? s.region! : DEFAULTS.region,
        give: (s.give ?? []).filter((g) => GIVE.some((x) => x.id === g)),
        ask: (s.ask ?? []).filter((a) => ASK.some((x) => x.id === a)),
        length: s.length === "all" || s.length === 10 || s.length === 20 ? s.length : 10,
        input: s.input === "libre" ? "libre" : "choix",
      };
    } catch { return DEFAULTS; }
  }
  let { preset: linkPreset }: { preset?: string } = $props();
  const init = load();
  // Arrivée depuis une page de quiz (hexapop.app/quiz/…) : le raccourci correspondant, sur toute la France.
  // svelte-ignore state_referenced_locally
  const fromLink = { carte: 0, numeros: 1, prefectures: 2, fiche: 3, expert: 4 }[linkPreset ?? ""];
  if (fromLink !== undefined) { init.give = [...PRESETS[fromLink].give]; init.ask = [...PRESETS[fromLink].ask]; init.zone = "france"; history.replaceState(null, "", location.pathname + "#entrainement"); }
  let zone = $state<Zone>(init.zone);
  let region = $state(init.region);
  let give = $state<Hint[]>(init.give.length ? init.give : DEFAULTS.give);
  let ask = $state<Field[]>(init.ask.length ? init.ask : DEFAULTS.ask);
  let length = $state<number | "all">(init.length);
  let input = $state<InputMode>(init.input);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const same = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((x) => b.includes(x));
  const preset = $derived(PRESETS.find((p) => same(p.give, give) && same(p.ask, ask)));
  function applyPreset(p: (typeof PRESETS)[number]) { give = [...p.give]; ask = [...p.ask]; }

  // ---------- dérivés ----------
  const pool = $derived(
    zone === "om" ? DEPARTEMENTS.filter((d) => d.outreMer).map((d) => d.code)
    : zone === "region" ? DEPARTEMENTS.filter((d) => d.region === region).map((d) => d.code)
    : DEPARTEMENTS.map((d) => d.code),
  );
  const count = $derived(length === "all" ? pool.length : Math.min(length, pool.length));
  const ok = $derived(give.length > 0 && ask.length > 0 && playable(give, ask));
  /** Nombre de choses à trouver par question (l'indice n'est jamais demandé). */
  const perQuestion = $derived(Math.max(...give.map((g) => ask.filter((f) => f !== g).length), 0));
  const problem = $derived(
    !give.length ? "Choisis au moins une chose qu'on te donne."
    : !ask.length ? "Choisis au moins une chose à trouver."
    : !ok ? "Il faut au moins une chose à trouver différente de ce qu'on te donne."
    : "",
  );

  $effect(() => {
    const s: Settings = { zone, region, give, ask, length, input };
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* navigation privée */ }
  });

  function start() {
    if (!ok) return;
    const expert = ask.includes("sousPrefectures") || ask.includes("limitrophes");
    const config: GameConfig = {
      seed: randomSeed(), level: expert ? "expert" : "normal", input,
      codes: pool, rounds: count, hints: [...give], ask: [...ask], durationMs: 0, switchable: true,
    };
    const mode: GameMode = zone === "france" && count >= 101 ? "marathon" : zone === "region" ? "region" : "eclair";
    const where = zone === "region" ? REGIONS.find((r) => r.code === region)!.nom : zone === "om" ? "Outre-mer" : "France";
    nav.go({ name: "play", mode, config, title: preset ? `${preset.nom} · ${where}` : `Entraînement · ${where}`, learn: true });
  }
</script>

<main class="training page">
  <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
  <div class="head">
    <Mascot mood="think" size={58} />
    <div><h1 class="title">Entraînement</h1><p>Choisis exactement ce que tu veux réviser. Sans chrono.</p></div>
  </div>

  {#if due}
    <button class="btn yellow revise" onclick={() => startSeance("revision")}>
      <b>Réviser {due} département{due > 1 ? "s" : ""}</b><small>Ceux dont une étoile est à revoir, partout en France.</small>
    </button>
  {/if}

  <section class="card">
    <h2 class="label">Raccourcis</h2>
    <div class="presets">
      {#each PRESETS as p (p.nom)}
        <button class="preset" class:on={preset === p} onclick={() => applyPreset(p)}><b>{p.nom}</b><small>{p.desc}</small></button>
      {/each}
    </div>
  </section>

  <section class="card">
    <div class="row">
      <h2 class="label">On te donne</h2>
      <div class="chips">
        {#each GIVE as g (g.id)}<button class="chip" class:on={give.includes(g.id)} aria-pressed={give.includes(g.id)} onclick={() => (give = toggle(give, g.id))}>{g.label}</button>{/each}
      </div>
      <p class="hint">« La carte » : le département clignote, à toi de le reconnaître. Avec plusieurs choix, l'indice change d'une question à l'autre.</p>
    </div>
    <div class="row">
      <h2 class="label">On te demande</h2>
      <div class="chips">
        {#each ASK as a (a.id)}<button class="chip" class:on={ask.includes(a.id)} class:exp={a.expert} aria-pressed={ask.includes(a.id)} onclick={() => (ask = toggle(ask, a.id))}>{a.label}</button>{/each}
      </div>
      <p class="hint" class:err={!!problem}>
        {#if problem}{problem}
        {:else if perQuestion <= 1}Questions simples : une seule chose à trouver à chaque fois.
        {:else}Fiche complète : jusqu'à {perQuestion} choses à trouver par question, le « à moitié bon » compte.{/if}
      </p>
    </div>
  </section>

  <section class="card">
    <div class="row">
      <h2 class="label">Zone</h2>
      <div class="seg">
        <button class:on={zone === "france"} onclick={() => (zone = "france")}>France</button>
        <button class:on={zone === "region"} onclick={() => (zone = "region")}>Une région</button>
        <button class:on={zone === "om"} onclick={() => (zone = "om")}>Outre-mer</button>
      </div>
      {#if zone === "region"}
        <div class="chips">
          {#each METRO_REGIONS as r (r.code)}<button class="chip" class:on={region === r.code} onclick={() => (region = r.code)}>{r.nom}</button>{/each}
        </div>
      {/if}
    </div>
    <div class="row">
      <h2 class="label">Longueur</h2>
      <div class="seg">
        {#if pool.length > 10}<button class:on={length === 10} onclick={() => (length = 10)}>10</button>{/if}
        {#if pool.length > 20}<button class:on={length === 20} onclick={() => (length = 20)}>20</button>{/if}
        <button class:on={length === "all" || pool.length <= (length as number)} onclick={() => (length = "all")}>{zone === "france" ? "Les 101 · Marathon" : `Toute la zone (${pool.length})`}</button>
      </div>
    </div>
    <div class="row">
      <h2 class="label">Réponses</h2>
      <div class="seg">
        <button class:on={input === "choix"} onclick={() => (input = "choix")}>Propositions</button>
        <button class:on={input === "libre"} onclick={() => (input = "libre")}>Au clavier</button>
      </div>
      <p class="hint">Changeable à tout moment pendant la partie. En propositions, pour placer sur la carte, tu choisis parmi 4 départements surlignés.</p>
    </div>
  </section>

  <div class="go"><button class="btn big wide" disabled={!ok} onclick={start}>C'est parti · {count} département{count > 1 ? "s" : ""}</button></div>
</main>

<style>
  .training { --w: 760px; display: flex; flex-direction: column; gap: 16px; }
  .back { align-self: flex-start; }
  .head { display: flex; gap: 14px; align-items: center; }
  .head p { color: var(--soft); font-weight: 600; }
  .revise { flex-direction: column; align-items: flex-start; text-align: left; gap: 4px; padding: 16px 20px; }
  .revise b { font-size: 21px; font-weight: 900; }
  .revise small { font-size: 14px; font-weight: 600; opacity: .85; }
  .card { display: flex; flex-direction: column; gap: 18px; }
  .row { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  h2 { margin: 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 7px; }
  .chip:not(.on) { background: var(--bg); box-shadow: 0 3px 0 var(--line); }
  .chip.exp:not(.on) { color: var(--pink-d); }
  .hint { margin: 0; font-size: 14px; color: var(--soft); font-weight: 600; }
  .hint.err { color: var(--pink-d); }
  .presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; width: 100%; }
  .preset { border: 0; text-align: left; background: var(--bg); border-radius: 14px; padding: 10px 12px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 3px 0 var(--line); }
  .preset b { font-weight: 900; font-size: 15.5px; }
  .preset small { color: var(--soft); font-weight: 600; font-size: 13px; line-height: 1.25; }
  .preset.on { background: var(--ink); color: #fff; box-shadow: 0 3px 0 #000; }
  .preset.on small { color: #d9d6ea; }
  .preset:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--line); }
  .go { position: sticky; bottom: 0; padding: 10px 0 calc(6px + env(safe-area-inset-bottom)); background: linear-gradient(transparent, var(--bg) 30%); }
  @media (max-width: 600px) { .presets { grid-template-columns: 1fr 1fr; } .seg { flex-wrap: wrap; } }
</style>
