<script lang="ts">
  import { DEP } from "@hexa/game";
  // Abréviations des régions, comme sur le bandeau droit des plaques.
  const ABBR: Record<string, string> = { "11": "IDF", "24": "CVL", "27": "BFC", "28": "NOR", "32": "HDF", "44": "GES", "52": "PDL", "53": "BRE", "75": "NAQ", "76": "OCC", "84": "ARA", "93": "PAC", "94": "COR", "01": "GUA", "02": "MTQ", "03": "GUY", "04": "RUN", "06": "MAY" };
  let { code, missing = false, big = false }: { code: string; missing?: boolean; big?: boolean } = $props();
  const d = $derived(DEP.get(code)!);
</script>

<span class="plate" class:missing class:holo={d.outreMer && !missing} class:big aria-label={missing ? "Plaque à découvrir" : `Plaque ${d.code}, ${d.nom}`}>
  <span class="b">F</span><span class="t tabnum">{missing ? "??" : d.code}</span><span class="b">{ABBR[d.region] ?? ""}</span>
</span>

<style>
  .plate.big .t { font-size: 22px; padding: 8px 14px; }
  .plate.big .b { font-size: 13px; padding: 4px 8px; }
  .missing { border-style: dashed; border-color: #bdb4a2; color: #bdb4a2; background: transparent; }
  .missing .b { background: #d3cbb9; }
  .holo { background: linear-gradient(110deg, #fff 20%, #ffe3f3 35%, #d8f0ff 50%, #fff8c9 65%, #fff 80%); background-size: 250% 100%; animation: holo 3s linear infinite; }
  @keyframes holo { to { background-position: -250% 0; } }
</style>
