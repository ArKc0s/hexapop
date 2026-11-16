<script lang="ts">
  import { dep, REGION, withArticle } from "@hexa/game";
  let { code, expert = true }: { code: string; expert?: boolean } = $props();
  const d = $derived(dep(code));
</script>

<div class="fiche">
  <div class="head"><span class="title code num">{d.code}</span><div><div class="nom">{d.nom}</div><div class="reg">{REGION.get(d.region)?.nom}</div></div></div>
  <dl>
    <dt>Préfecture</dt><dd>{d.prefecture}</dd>
    {#if expert}
      <dt>Sous-préf.</dt><dd>{d.sousPrefectures.length ? d.sousPrefectures.join(", ") : "aucune"}</dd>
      <dt>Voisins</dt><dd>{d.limitrophes.length ? d.limitrophes.map((c) => `${dep(c).nom} (${c})`).join(", ") : "aucun (" + (d.outreMer ? "outre-mer" : "île") + ")"}</dd>
    {/if}
  </dl>
  <span class="sr">{withArticle(d)}</span>
</div>

<style>
  .fiche { border: 1.5px solid var(--line); border-radius: var(--r); background: var(--card); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
  .head { display: flex; gap: 14px; align-items: center; }
  .code { font-size: 40px; font-family: var(--f-ui); font-weight: 600; letter-spacing: -.02em; }
  .nom { font-weight: 800; font-size: 20px; line-height: 1.1; }
  .reg { font-size: 13px; color: var(--soft); }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; font-size: 14px; }
  dt { color: var(--soft); }
  dd { margin: 0; font-weight: 600; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
