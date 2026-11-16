<script lang="ts">
  import { nav, type SoloMode } from "../lib/nav.svelte.ts";
  import Mascot from "../lib/ui/Mascot.svelte";
  const MODES: { mode: SoloMode; nom: string; desc: string; color: string }[] = [
    { mode: "apprendre", nom: "Révisions", desc: "12 départements choisis selon tes erreurs : ceux que tu rates reviennent plus souvent.", color: "yellow" },
    { mode: "eclair", nom: "Éclair", desc: "20 départements au hasard, pour s'échauffer.", color: "pink" },
    { mode: "region", nom: "Une région", desc: "Toute une région, sans pression d'étoiles.", color: "blue" },
    { mode: "marathon", nom: "Marathon", desc: "Les 101 d'affilée. Badge Marathonien à la clé.", color: "ink" },
  ];
</script>

<main class="training">
  <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
  <div class="head"><Mascot mood="think" size={58} /><div><h1 class="title">Entraînement</h1><p>Pour réviser à ta façon. Chaque partie rapporte de l'XP et des plaques.</p></div></div>
  <div class="grid">
    {#each MODES as m (m.mode)}
      <button class="btn {m.color} mode" onclick={() => nav.go({ name: "setup", mode: m.mode })}><b>{m.nom}</b><small>{m.desc}</small></button>
    {/each}
  </div>
</main>

<style>
  .training { max-width: 760px; margin: 0 auto; padding: 20px 20px 48px; display: flex; flex-direction: column; gap: 20px; }
  .back { align-self: flex-start; }
  .head { display: flex; gap: 14px; align-items: center; }
  .head p { color: var(--soft); font-weight: 600; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .mode { flex-direction: column; align-items: flex-start; text-align: left; gap: 6px; padding: 20px; min-height: 130px; justify-content: flex-start; }
  .mode b { font-size: 24px; font-weight: 900; }
  .mode small { font-size: 14.5px; font-weight: 600; opacity: .9; line-height: 1.3; }
  @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
  @media (min-width: 701px) { .training { min-height: 100dvh; justify-content: center; } }
</style>
