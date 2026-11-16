<script lang="ts">
  import { dep, REGION, withArticle } from "@hexa/game";
  let { code, expert = true }: { code: string; expert?: boolean } = $props();
  const d = $derived(dep(code));
</script>

<div class="fiche">
  <div class="head"><span class="riso num" data-t={d.code}>{d.code}</span><div><div class="nom">{d.nom}</div><div class="reg">{REGION.get(d.region)?.nom}</div></div></div>
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
  .fiche { border: 3px solid var(--ink); border-radius: var(--r); background: #fff; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
  .head { display: flex; gap: 14px; align-items: center; }
  .num { font-size: 48px; }
  .nom { font-family: var(--f-pop); font-size: 22px; line-height: 1.05; text-transform: uppercase; }
  .reg { font-size: 13px; color: var(--ink-soft); }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; font-size: 14px; }
  dt { color: var(--ink-soft); }
  dd { margin: 0; font-weight: 600; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
