<script lang="ts">
  // Les kilomètres comme une barre d'expérience : la route d'Hexa et sa prochaine étape.
  import { roadTrip } from "@hexa/game";
  import { onMount } from "svelte";

  let { km, gain = 0, compact = false }: { km: number; gain?: number; compact?: boolean } = $props();
  // À l'écran de fin, la barre part d'avant la partie et avance jusqu'au nouveau total.
  // svelte-ignore state_referenced_locally
  let shown = $state(Math.max(0, km - gain));
  onMount(() => { const t = setTimeout(() => (shown = km), gain ? 350 : 0); return () => clearTimeout(t); });
  $effect(() => { if (!gain) shown = km; });
  const trip = $derived(roadTrip(shown));
  const fmt = (n: number) => n.toLocaleString("fr-FR");
</script>

<div class="road" class:compact title="Chaque bonne réponse fait avancer Hexa sur la route">
  <div class="row">
    <span class="k">Route d'Hexa</span>
    <b class="tabnum">{fmt(km)} km</b>
  </div>
  <div class="bar" role="progressbar" aria-valuemin={trip.last.km} aria-valuemax={trip.next?.km ?? trip.last.km} aria-valuenow={shown} aria-label="Vers la prochaine étape">
    <span style="width:{trip.ratio * 100}%"></span>
  </div>
  <div class="row small">
    <span>{trip.last.km ? `${trip.last.trip} : fait` : "Chaque bonne réponse fait avancer Hexa"}</span>
    {#if trip.next}<span class="tabnum">{trip.next.name} dans <b>{fmt(trip.left)} km</b></span>{/if}
  </div>
</div>

<style>
  .road { display: flex; flex-direction: column; gap: 5px; width: 100%; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .k { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--soft); }
  .row > b { font-weight: 900; font-size: 17px; }
  .small { font-size: 13px; font-weight: 700; color: var(--soft); }
  .small b { color: var(--ink); }
  .bar { position: relative; height: 12px; border-radius: 999px; background: var(--ink); overflow: hidden; }
  /* Ligne pointillée de la route, sous la partie parcourue */
  .bar::before { content: ""; position: absolute; left: 6px; right: 6px; top: 50%; height: 2px; margin-top: -1px; background: repeating-linear-gradient(90deg, #fff8 0 8px, transparent 8px 16px); }
  .bar span { position: absolute; inset: 0 auto 0 0; background: var(--yellow); border-radius: 999px; transition: width 1.1s cubic-bezier(.2,.8,.2,1); min-width: 12px; }
  .compact .small span:first-child { display: none; }
  .compact .small { justify-content: flex-end; }
</style>
