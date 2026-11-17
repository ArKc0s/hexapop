<script lang="ts">
  // Fenêtre posée sur une partie : pause, ou « Quitter la partie ? ».
  // Opaque par défaut : en pause, on ne voit ni la question ni la carte (sinon la pause servirait à réfléchir).
  import type { Snippet } from "svelte";
  import Mascot from "./Mascot.svelte";

  interface Props {
    title: string;
    mood?: "happy" | "think" | "sad" | "wow";
    /** Bouton principal (rester, reprendre). */
    primary: string;
    onprimary: () => void;
    /** Bouton secondaire (quitter). */
    secondary: string;
    onsecondary: () => void;
    /** Laisse voir la partie derrière (multijoueur : rien à cacher, le temps ne s'arrête pas). */
    seeThrough?: boolean;
    children?: Snippet;
  }
  let { title, mood = "think", primary, onprimary, secondary, onsecondary, seeThrough = false, children }: Props = $props();

  let first: HTMLButtonElement | undefined = $state();
  $effect(() => { first?.focus(); });
  function onkey(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onprimary(); }
  }
</script>

<svelte:window onkeydowncapture={onkey} />

<div class="veil" class:see={seeThrough} role="presentation">
  <div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="gs-t">
    <Mascot {mood} size={64} />
    <h2 id="gs-t">{title}</h2>
    {@render children?.()}
    <div class="acts">
      <button class="btn blue big" bind:this={first} onclick={onprimary}>{primary}</button>
      <button class="btn white" onclick={onsecondary}>{secondary}</button>
    </div>
  </div>
</div>

<style>
  .veil { position: fixed; inset: 0; background: var(--bg); display: grid; place-items: center; z-index: 60; padding: 16px; animation: fade .15s; }
  .veil.see { background: rgba(28, 26, 55, .4); place-items: end center; }
  .sheet { background: #fff; border-radius: 28px; padding: 26px 22px calc(20px + env(safe-area-inset-bottom)); width: min(440px, 100%); display: flex; flex-direction: column; gap: 10px; align-items: center; text-align: center; box-shadow: 0 6px 0 var(--line); animation: pop-in .25s cubic-bezier(.2, 1.4, .4, 1); }
  h2 { font-size: 24px; font-weight: 900; margin: 0; }
  .sheet :global(p) { color: var(--soft); font-weight: 600; margin: 0; }
  .acts { display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: 8px; }
  .acts .btn { width: 100%; }
  .acts .btn.white { --c: var(--bg); --cd: var(--line); }
  @media (min-width: 701px) { .veil.see { place-items: center; } }
  @keyframes fade { from { opacity: 0; } }
</style>
