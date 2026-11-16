<script lang="ts">
  let { n = 0, of = 3, size = 22, animate = false }: { n?: number; of?: number; size?: number; animate?: boolean } = $props();
  const STAR = "M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z";
</script>

<span class="stars" role="img" aria-label="{n} étoile{n > 1 ? 's' : ''} sur {of}">
  {#each Array(of) as _, i (i)}
    <svg width={i === 1 && animate ? size * 1.3 : size} height={i === 1 && animate ? size * 1.3 : size} viewBox="0 0 24 24" class:on={i < n} class:anim={animate} style="animation-delay:{i * 0.25}s" aria-hidden="true">
      <path d={STAR} stroke-linejoin="round" />
    </svg>
  {/each}
</span>

<style>
  .stars { display: inline-flex; gap: 2px; align-items: flex-end; }
  path { fill: #e4ddcc; stroke: #d6cdb9; stroke-width: 1.2; }
  .on path { fill: var(--yellow); stroke: var(--yellow-d); }
  .anim { animation: star-in .6s cubic-bezier(.2, 1.6, .4, 1) both; }
  @keyframes star-in { from { transform: scale(0) rotate(-40deg); opacity: 0; } }
</style>
