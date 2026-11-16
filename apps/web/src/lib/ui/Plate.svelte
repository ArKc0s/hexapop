<script lang="ts">
  import { DEP } from "@hexa/game";
  // Abréviations des régions, comme sur le bandeau droit des plaques.
  const ABBR: Record<string, string> = { "11": "IDF", "24": "CVL", "27": "BFC", "28": "NOR", "32": "HDF", "44": "GES", "52": "PDL", "53": "BRE", "75": "NAQ", "76": "OCC", "84": "ARA", "93": "PAC", "94": "COR", "01": "GUA", "02": "MTQ", "03": "GUY", "04": "RUN", "06": "MAY" };
  const NAMES = ["", "bronze", "argent", "or"];
  /** tier : 0 = à découvrir, 1 bronze, 2 argent, 3 or. */
  let { code, tier = 1, big = false }: { code: string; tier?: number; big?: boolean } = $props();
  const d = $derived(DEP.get(code)!);
</script>

<span class="plate t{tier}" class:missing={!tier} class:holo={d.outreMer && tier > 0} class:big
  aria-label={tier ? `Plaque ${d.code}, ${d.nom}, ${NAMES[tier]}` : "Plaque à découvrir"}>
  <span class="b">F</span><span class="t tabnum">{tier ? d.code : "??"}</span><span class="b">{ABBR[d.region] ?? ""}</span>
</span>

<style>
  .plate.big .t { font-size: 22px; padding: 8px 14px; }
  .plate.big .b { font-size: 13px; padding: 4px 8px; }
  /* Le bandeau de gauche donne le palier */
  .t1 > .b:first-child { background: #b0703c; }
  .t2 > .b:first-child { background: #8c97a8; }
  .t3 > .b:first-child { background: var(--yellow-d); }
  .t3 { box-shadow: 0 0 0 2px #ffe58a; }
  .missing { border-style: dashed; border-color: #bdb4a2; color: #bdb4a2; background: transparent; }
  .missing .b { background: #d3cbb9 !important; }
  .holo { background: linear-gradient(110deg, #fff 20%, #ffe3f3 35%, #d8f0ff 50%, #fff8c9 65%, #fff 80%); background-size: 250% 100%; animation: holo 3s linear infinite; }
  @keyframes holo { to { background-position: -250% 0; } }
</style>
