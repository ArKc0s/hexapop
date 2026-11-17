<script lang="ts">
  // Nouveautés : les notes de version, côté joueur.
  import { NEWS, markNewsSeen, newsSeen } from "../lib/news.ts";
  import { nav } from "../lib/nav.svelte.ts";
  import { VERSION } from "../lib/version.ts";
  import Mascot from "../lib/ui/Mascot.svelte";

  const seenBefore = newsSeen();
  markNewsSeen();
  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
</script>

<main class="news page">
  <header>
    <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
  </header>
  <div class="head">
    <Mascot mood="wow" size={60} />
    <div><h1 class="title">Nouveautés</h1><p>Ce qui a changé dans Hexa. Tu joues à la version {VERSION}.</p></div>
  </div>
  <ol class="list">
    {#each NEWS as n (n.id)}
      <li class="card" class:fresh={n.id > seenBefore && seenBefore > 0}>
        <div class="meta"><span class="v">v{n.version}</span><span>{fmt(n.date)}</span>{#if n.id > seenBefore && seenBefore > 0}<span class="new">Nouveau</span>{/if}</div>
        <h2>{n.title}</h2>
        <ul>{#each n.items as it (it)}<li>{it}</li>{/each}</ul>
      </li>
    {/each}
  </ol>
  <p class="foot">Une idée, un bug ? <button class="link" onclick={() => nav.go({ name: "legal", doc: "apropos" })}>Écris-nous depuis À propos</button>.</p>
</main>

<style>
  .news { --w: 760px; display: flex; flex-direction: column; gap: 16px; }
  header { display: flex; }
  .head { display: flex; gap: 14px; align-items: center; }
  .head p { margin: 0; color: var(--soft); font-weight: 600; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .card { background: #fff; border-radius: 22px; padding: 16px 20px; box-shadow: 0 4px 0 var(--line); }
  .card.fresh { box-shadow: 0 4px 0 var(--line), inset 0 0 0 2px var(--pink); }
  .meta { display: flex; gap: 10px; align-items: center; font-size: 13px; font-weight: 700; color: var(--soft); }
  .v { background: var(--ink); color: #fff; border-radius: 999px; padding: 1px 9px; font-weight: 800; }
  .new { background: var(--pink); color: #fff; border-radius: 999px; padding: 1px 9px; font-weight: 800; }
  h2 { font-size: 19px; font-weight: 900; margin: 6px 0 4px; }
  ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 3px; font-weight: 600; }
  .foot { color: var(--soft); font-weight: 600; text-align: center; }
</style>
