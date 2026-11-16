<script lang="ts">
  // Hexa, la mascotte : un hexagone (l'Hexagone !) rose à ombre bleue, trois humeurs.
  export type Mood = "happy" | "think" | "sad" | "wow";
  let { mood = "happy", size = 64 }: { mood?: Mood; size?: number } = $props();
  const HEX = "M36 6 L60 19 Q64 21 64 26 L64 50 Q64 55 60 57 L36 70 Q32 72 28 70 L4 57 Q0 55 0 50 L0 26 Q0 21 4 19 L28 6 Q32 4 36 6Z";
</script>

<svg class="mascot {mood}" width={size} height={size} viewBox="-4 -2 76 80" aria-hidden="true">
  <path d={HEX} transform="translate(4 4)" fill="var(--blue)" />
  <path d={HEX} fill="var(--pink)" />
  <ellipse cx="22" cy="34" rx="7" ry="8" fill="#fff" /><ellipse cx="42" cy="34" rx="7" ry="8" fill="#fff" />
  {#if mood === "wow"}
    <circle cx="22" cy="34" r="4" fill="var(--ink)" /><circle cx="42" cy="34" r="4" fill="var(--ink)" />
    <ellipse cx="32" cy="50" rx="5" ry="6" fill="var(--ink)" />
  {:else}
    <circle cx="23.5" cy="35.5" r="3.6" fill="var(--ink)" /><circle cx="43.5" cy="35.5" r="3.6" fill="var(--ink)" />
  {/if}
  <circle cx="14" cy="46" r="3.5" fill="var(--yellow)" opacity=".85" /><circle cx="50" cy="46" r="3.5" fill="var(--yellow)" opacity=".85" />
  {#if mood === "happy"}
    <path d="M24 46 Q32 55 40 46" fill="none" stroke="var(--ink)" stroke-width="3.2" stroke-linecap="round" />
  {:else if mood === "think"}
    <path d="M26 49 L38 47" fill="none" stroke="var(--ink)" stroke-width="3.2" stroke-linecap="round" />
    <path d="M16 24 L27 22" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" />
  {:else if mood === "sad"}
    <path d="M25 51 Q32 44 39 51" fill="none" stroke="var(--ink)" stroke-width="3.2" stroke-linecap="round" />
    <path d="M16 23 L27 27 M48 23 L37 27" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" />
  {/if}
</svg>

<style>
  .mascot { flex: none; display: block; }
  .happy, .wow { animation: bounce .5s cubic-bezier(.2, 1.6, .4, 1); }
  .sad { animation: shake .35s; }
  @keyframes bounce { 0% { transform: scale(.85) translateY(4px); } 100% { transform: none; } }
</style>
