<script lang="ts">
  import { DEPARTEMENTS, REGIONS, mastery, pickSession, randomSeed, type GameConfig, type InputMode, type Level } from "@hexa/game";
  import { nav, type SoloMode } from "../lib/nav.svelte.ts";
  import { progress } from "../lib/progress.svelte.ts";

  let { mode }: { mode: SoloMode } = $props();

  const all = DEPARTEMENTS.map((d) => d.code);
  const byRegion = [...DEPARTEMENTS].sort((a, b) => a.region.localeCompare(b.region) || a.code.localeCompare(b.code)).map((d) => d.code);
  const beginner = mastery(progress.data, all) < 30;

  const TITLES: Record<SoloMode, [string, string]> = {
    apprendre: ["Apprendre", "12 départements choisis pour toi : ceux que tu rates reviennent, des nouveaux arrivent région par région."],
    eclair: ["Éclair", "20 départements au hasard, chrono serré."],
    region: ["Par région", "Tous les départements d'une région."],
    marathon: ["Marathon", "Les 101 départements, outre-mer compris. Compte 15 à 25 minutes."],
  };

  let level = $state<Level>("normal");
  let input = $state<InputMode>(beginner ? "choix" : "libre");
  let region = $state(REGIONS[0].code);

  function start() {
    const base = { seed: randomSeed(), level, input };
    let config: GameConfig;
    if (mode === "apprendre") config = { ...base, codes: pickSession(progress.data, byRegion, 12, Date.now()) };
    else if (mode === "eclair") config = { ...base, rounds: 20 };
    else if (mode === "region") config = { ...base, codes: DEPARTEMENTS.filter((d) => d.region === region).map((d) => d.code) };
    else config = base;
    const title = mode === "region" ? REGIONS.find((r) => r.code === region)!.nom : TITLES[mode][0];
    nav.go({ name: "play", config, title, learn: true });
  }
</script>

<main class="setup">
  <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
  <h1 class="riso" data-t={TITLES[mode][0].toUpperCase()}>{TITLES[mode][0].toUpperCase()}</h1>
  <p>{TITLES[mode][1]}</p>

  {#if mode === "region"}
    <fieldset>
      <legend class="label">Région</legend>
      <div class="opts wrap">
        {#each REGIONS as r (r.code)}
          <button class="chip" class:on={region === r.code} onclick={() => (region = r.code)}>{r.nom}</button>
        {/each}
      </div>
    </fieldset>
  {/if}

  <fieldset>
    <legend class="label">Niveau</legend>
    <div class="opts">
      <button class="opt" class:on={level === "normal"} onclick={() => (level = "normal")}><b>Normal</b><span>carte, nom ou numéro, préfecture</span></button>
      <button class="opt" class:on={level === "expert"} onclick={() => (level = "expert")}><b>Expert</b><span>+ sous-préfectures et départements voisins</span></button>
    </div>
  </fieldset>

  <fieldset>
    <legend class="label">Réponses</legend>
    <div class="opts">
      <button class="opt" class:on={input === "choix"} onclick={() => (input = "choix")}><b>Choix</b><span>4 propositions, idéal pour débuter</span></button>
      <button class="opt" class:on={input === "libre"} onclick={() => (input = "libre")}><b>Au clavier</b><span>accents et petites fautes tolérés</span></button>
    </div>
  </fieldset>

  <button class="btn go" onclick={start}>C'est parti</button>
</main>

<style>
  .setup { max-width: 720px; margin: 0 auto; padding: 28px 20px 60px; display: flex; flex-direction: column; gap: 20px; }
  .back { align-self: flex-start; background: none; border: 0; cursor: pointer; font-weight: 600; padding: 0; }
  h1 { font-size: clamp(48px, 9vw, 80px); margin: 0; }
  p { margin: 0; max-width: 55ch; }
  fieldset { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .opts.wrap { display: flex; flex-wrap: wrap; gap: 8px; }
  .opts.wrap .chip { cursor: pointer; }
  .opt { text-align: left; border: 3px solid var(--ink); border-radius: 12px; padding: 12px 14px; background: transparent; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
  .opt.on { background: var(--yellow); box-shadow: 4px 4px 0 var(--pink); }
  .opt b { font-family: var(--f-pop); font-weight: 400; font-size: 18px; text-transform: uppercase; }
  .opt span { font-size: 13px; }
  .go { align-self: flex-start; font-size: 22px; padding: 12px 28px; }
  @media (max-width: 520px) { .opts { grid-template-columns: 1fr; } }
</style>
