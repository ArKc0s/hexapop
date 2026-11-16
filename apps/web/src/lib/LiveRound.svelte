<script lang="ts">
  import { grade, type Answer, type Question } from "@hexa/game";
  import Round from "./Round.svelte";
  import { live } from "./socket.svelte.ts";
  import type { Snippet } from "svelte";

  let { children, header, readonly = false }: { children?: Snippet; header?: Snippet; readonly?: boolean } = $props();

  const q = $derived(live.question as Question | null);
  const result = $derived.by(() => {
    if (!q || !live.summary || live.summary.index !== q.index) return null;
    // Pas de réponse reçue : on affiche quand même la correction, à 0 point.
    return live.summary.results[live.you ?? ""] ?? grade(q, { elapsedMs: q.durationMs });
  });

  function submit(a: Answer) {
    if (!q || readonly) return;
    const { elapsedMs: _, ...answer } = a;
    live.send({ t: "answer", index: q.index, answer });
  }
</script>

{#if q}
  {#key q.index}
    <Round {q} {result} startedAt={live.toPerf(live.question!.startsAt)} onsubmit={submit} {header}>
      {@render children?.()}
    </Round>
  {/key}
{/if}
