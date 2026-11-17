<script lang="ts">
  // Les kilomètres comme une barre d'expérience, sur deux échelles : le grand voyage (en haut), et le tronçon
  // où Hexa roule d'une escale à la suivante (la route). Communs à tous les atlas.
  import { roadTrip, VOYAGES } from "@hexa/game";
  import { onMount } from "svelte";
  import Mascot from "./Mascot.svelte";

  let { km, gain = 0 }: { km: number; gain?: number } = $props();
  // À l'écran de fin, Hexa part d'avant la partie et roule jusqu'au nouveau total.
  // svelte-ignore state_referenced_locally
  let shown = $state(Math.max(0, km - gain));
  onMount(() => { const t = setTimeout(() => (shown = km), gain ? 400 : 0); return () => clearTimeout(t); });
  $effect(() => { if (!gain) shown = km; });
  const trip = $derived(roadTrip(shown));
  const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");
  /** Tronçons du grand voyage en cours, proportionnels à leur longueur. */
  const legs = $derived(VOYAGES.find((v) => v.name === trip.voyage)!.stops.slice(1).map((s) => s.km));
</script>

<div class="road" title="Chaque bonne réponse fait avancer Hexa sur la route">
  <div class="top">
    <span class="k">Grand voyage{trip.cycle > 1 ? ` n° ${trip.cycle}` : ""}</span>
    <b class="tabnum">{fmt(km)} km</b>
  </div>
  <div class="voyage">
    <b>{trip.voyage}</b>
    <span class="tabnum">étape {trip.leg}/{trip.legs} · {Math.floor(trip.voyageRatio * 100)} %</span>
  </div>
  <div class="legs" aria-hidden="true">
    {#each legs as l, i (i)}<i style="flex:{l}" class:done={i < trip.leg - 1} class:cur={i === trip.leg - 1}><span style="width:{i === trip.leg - 1 ? trip.ratio * 100 : 0}%"></span></i>{/each}
  </div>
  <div class="track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(trip.ratio * 100)} aria-label="De {trip.from} à {trip.to}">
    <div class="asphalt"><span class="done" style="width:{trip.ratio * 100}%"></span></div>
    <i class="city from"></i>
    <i class="city to"></i>
    <span class="hexa" style="left:calc(11px + (100% - 22px) * {trip.ratio})"><Mascot mood="happy" size={30} /></span>
  </div>
  <div class="cities">
    <b>{trip.from}</b>
    <span class="tabnum">encore <b>{fmt(trip.left)} km</b></span>
    <b>{trip.to}</b>
  </div>
</div>

<style>
  .road { display: flex; flex-direction: column; gap: 4px; width: 100%; }
  .top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .k { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--soft); }
  .top > b { font-weight: 900; font-size: 17px; }
  .voyage { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-top: -2px; }
  .voyage b { font-weight: 900; font-size: 15.5px; }
  .voyage span { font-size: 13px; font-weight: 700; color: var(--soft); white-space: nowrap; }
  /* Le grand voyage : un segment par tronçon, proportionnel à sa longueur */
  .legs { display: flex; gap: 3px; height: 6px; margin: 2px 0 0; }
  .legs i { position: relative; border-radius: 3px; background: var(--line); overflow: hidden; min-width: 3px; }
  .legs i.done { background: var(--ink); }
  .legs i span { position: absolute; inset: 0 auto 0 0; background: var(--ink); transition: width 1.2s cubic-bezier(.3,.8,.3,1); }
  .track { position: relative; height: 38px; }
  /* La route va du centre d'une ville au centre de l'autre ; les villes sont posées dessus, comme des épingles. */
  .asphalt { position: absolute; left: 11px; right: 11px; top: 50%; height: 14px; margin-top: -7px; background: var(--ink); overflow: hidden; }
  /* Marquage au sol sur ce qui reste à parcourir */
  .asphalt::before { content: ""; position: absolute; inset: 6px 0 auto; height: 2px; background: repeating-linear-gradient(90deg, #fff9 0 10px, transparent 10px 20px); }
  .done { position: absolute; inset: 0 auto 0 0; background: var(--yellow); transition: width 1.2s cubic-bezier(.3,.8,.3,1); }
  .city { position: absolute; top: 50%; width: 22px; height: 22px; margin-top: -11px; box-sizing: border-box; border-radius: 50%; border: 4px solid var(--ink); background: #fff; z-index: 1; }
  .city.from { left: 0; background: var(--yellow); }
  .city.to { right: 0; }
  .hexa { position: absolute; top: 50%; transform: translate(-50%, -62%); transition: left 1.2s cubic-bezier(.3,.8,.3,1); z-index: 2; filter: drop-shadow(0 2px 0 #0002); }
  .cities { display: grid; grid-template-columns: 1fr auto 1fr; align-items: baseline; gap: 8px; font-size: 13.5px; font-weight: 700; color: var(--soft); line-height: 1.2; }
  .cities > b { color: var(--ink); font-weight: 900; }
  .cities > b:last-child { text-align: right; }
  .cities span { text-align: center; white-space: nowrap; }
  .cities span b { color: var(--ink); }
</style>
