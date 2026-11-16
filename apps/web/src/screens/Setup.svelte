<script lang="ts">
  import { DEPARTEMENTS, REGIONS, mastery, pickSession, randomSeed, type GameConfig, type InputMode, type Level } from "@hexa/game";
  import { nav, type SoloMode } from "../lib/nav.svelte.ts";
  import { progress } from "../lib/progress.svelte.ts";

  let { mode }: { mode: SoloMode } = $props();

  const all = DEPARTEMENTS.map((d) => d.code);
  const byRegion = [...DEPARTEMENTS].sort((a, b) => a.region.localeCompare(b.region) || a.code.localeCompare(b.code)).map((d) => d.code);
  const beginner = mastery(progress.data, all) < 30;

  const TITLES: Record<SoloMode, [string, string]> = {
    apprendre: ["Révisions", "12 départements choisis pour toi. Ceux que tu rates reviennent plus souvent, et les nouveaux arrivent région par région."],
    eclair: ["Éclair", "20 départements tirés au hasard."],
    region: ["Par région", "Tous les départements d'une région, dans le désordre."],
    marathon: ["Marathon", "Les 101 départements d'affilée, outre-mer compris. Compte 15 à 25 minutes."],
  };

  let level = $state<Level>("normal");
  let input = $state<InputMode>(beginner ? "choix" : "libre");
  let region = $state(REGIONS[0].code);
  const count = $derived(mode === "region" ? DEPARTEMENTS.filter((d) => d.region === region).length : mode === "apprendre" ? 12 : mode === "eclair" ? 20 : 101);

  function start() {
    const base = { seed: randomSeed(), level, input };
    let config: GameConfig;
    if (mode === "apprendre") config = { ...base, codes: pickSession(progress.data, byRegion, 12, Date.now()) };
    else if (mode === "eclair") config = { ...base, rounds: 20 };
    else if (mode === "region") config = { ...base, codes: DEPARTEMENTS.filter((d) => d.region === region).map((d) => d.code) };
    else config = base;
    const title = mode === "region" ? REGIONS.find((r) => r.code === region)!.nom : TITLES[mode][0];
    nav.go({ name: "play", mode, config, title, learn: true });
  }
</script>

<main class="setup">
  <button class="back" onclick={() => nav.go({ name: "training" })}>← Entraînement</button>
  <h1 class="title">{TITLES[mode][0]}</h1>
  <p class="lead">{TITLES[mode][1]}</p>

  {#if mode === "region"}
    <section>
      <h2 class="label">Région</h2>
      <div class="wrap">
        {#each REGIONS as r (r.code)}<button class="chip" class:on={region === r.code} onclick={() => (region = r.code)}>{r.nom}</button>{/each}
      </div>
    </section>
  {/if}

  <section>
    <h2 class="label">Niveau</h2>
    <div class="seg"><button class:on={level === "normal"} onclick={() => (level = "normal")}>Normal</button><button class:on={level === "expert"} onclick={() => (level = "expert")}>Expert</button></div>
    <p class="hint">{level === "normal" ? "Carte, numéro et préfecture." : "En plus : les sous-préfectures et les départements voisins."}</p>
  </section>

  <section>
    <h2 class="label">Réponses</h2>
    <div class="seg"><button class:on={input === "choix"} onclick={() => (input = "choix")}>4 propositions</button><button class:on={input === "libre"} onclick={() => (input = "libre")}>Au clavier</button></div>
    <p class="hint">{input === "choix" ? "Idéal pour débuter." : "Les accents et les petites fautes de frappe sont tolérés."}</p>
  </section>

  <div class="go"><button class="btn big" onclick={start}>Jouer {count} département{count > 1 ? "s" : ""}</button></div>
</main>

<style>
  .setup { max-width: 640px; margin: 0 auto; padding: 24px 20px 60px; display: flex; flex-direction: column; gap: 22px; }
  .back { align-self: flex-start; }
  h1 { padding-top: 6px; }
  .lead { margin: -8px 0 0; font-size: 17px; max-width: 52ch; }
  section { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  h2 { margin: 0; }
  .hint { margin: 0; font-size: 14px; color: var(--soft); }
  .wrap { display: flex; flex-wrap: wrap; gap: 6px; }

  @media (min-width: 701px) { .setup { min-height: 100dvh; justify-content: center; } }
</style>
