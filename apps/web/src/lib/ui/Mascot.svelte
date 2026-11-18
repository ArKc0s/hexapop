<script lang="ts">
  // Hexa, la mascotte : un hexagone (l'Hexagone !) rose à ombre bleue, trois humeurs.
  // Hexa qui voyage (docs/atlas.md) : une tenue par atlas, portée d'office dans ce monde. Régions : un bob d'explorateur.
  // Monde : des lunettes d'aviateur relevées sur le front.
  import { world } from "../world.svelte.ts";
  export type Mood = "happy" | "think" | "sad" | "wow";
  export type Outfit = "none" | "bob" | "aviateur";
  let { mood = "happy", size = 64, outfit }: { mood?: Mood; size?: number; outfit?: Outfit } = $props();
  const wear = $derived<Outfit>(outfit ?? (world.id === "regions" ? "bob" : world.id === "monde" ? "aviateur" : "none"));
  const HEX = "M36 6 L60 19 Q64 21 64 26 L64 50 Q64 55 60 57 L36 70 Q32 72 28 70 L4 57 Q0 55 0 50 L0 26 Q0 21 4 19 L28 6 Q32 4 36 6Z";
</script>

<!-- Même cadre avec ou sans tenue : Hexa garde sa taille quand on change d'atlas, le chapeau déborde par le haut. -->
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
  {#if wear === "bob"}
    <!-- Bob d'explorateur, un peu de travers. Dessiné de l'arrière vers l'avant : le bord du fond, le dôme,
         son ruban, puis le bord de devant qui passe devant le bas du dôme. -->
    <g transform="rotate(-8 32 8)">
      <ellipse cx="32" cy="8" rx="26" ry="5.5" fill="var(--yellow-d)" />
      <path d="M15 8 C15.5 1 16.5 -4 19.5 -5.5 Q32 -10.5 44.5 -5.5 C47.5 -4 48.5 1 49 8 A17 3 0 0 1 15 8 Z" fill="var(--yellow)" />
      <path d="M16 1.5 A16.4 3 0 0 0 48.2 1.5 L48.9 6.6 A16.9 3 0 0 1 15.2 6.6 Z" fill="var(--blue)" />
      <path d="M6 8 A26 5.5 0 0 0 58 8 L49 8 A17 3 0 0 1 15 8 Z" fill="var(--yellow)" />
    </g>
  {/if}
  {#if wear === "aviateur"}
    <!-- Lunettes d'aviateur relevées sur le front : la sangle fait le tour de la tête, deux verres ronds. -->
    <path d="M3.2 19.5 Q32 13 60.8 19.5 L61.6 24.2 Q32 17.8 2.4 24.2 Z" fill="#8a5a2b" />
    <g stroke="var(--ink)" stroke-width="2.2">
      <circle cx="22" cy="17.5" r="7.4" fill="#bfe3f7" />
      <circle cx="42" cy="17.5" r="7.4" fill="#bfe3f7" />
    </g>
    <path d="M29.4 16.6 Q32 15 34.6 16.6" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round" />
    <path d="M18.4 15.2 Q20 12.6 23 12.4 M38.4 15.2 Q40 12.6 43 12.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".9" />
  {/if}
</svg>

<style>
  .mascot { flex: none; display: block; overflow: visible; }
  .happy, .wow { animation: bounce .5s cubic-bezier(.2, 1.6, .4, 1); }
  .sad { animation: shake .35s; }
  @keyframes bounce { 0% { transform: scale(.85) translateY(4px); } 100% { transform: none; } }
</style>
