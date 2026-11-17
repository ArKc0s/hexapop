<script lang="ts">
  // Hall of Fame (conception 4.6) : défi du jour (semaine, mois, par niveau), Marathon, Légendes.
  import { LEVELS, LEVEL_NAMES, LEVEL_OF, playerLevel, type Level } from "@hexa/game";
  import { api, session } from "../lib/api.svelte.ts";
  import { nav } from "../lib/nav.svelte.ts";
  import { profile } from "../lib/profile.svelte.ts";
  import Mascot from "../lib/ui/Mascot.svelte";

  interface Row { name: string; home: string | null }
  interface Hof {
    daily: { week: Record<Level, (Row & { points: number; days: number })[]>; month: Record<Level, (Row & { points: number; days: number })[]>; since: { week: string; month: string } };
    marathon: (Row & { accuracy: number; elapsedMs: number; at: number })[];
    legends: Record<"france" | "argent" | "or", (Row & { at: number })[]>;
  }
  let hof = $state<Hof | null>(null);
  let failed = $state(false);
  api<Hof>("GET", "/hof").then((h) => (hof = h)).catch(() => (failed = true));

  let tab = $state<"defi" | "marathon" | "legendes">("defi");
  let period = $state<"week" | "month">("week");
  let level = $state<Level>(LEVEL_OF[playerLevel(profile.data.know ?? {})]);
  const me = $derived(session.me?.pseudo);
  const fmt = (t: number) => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const dur = (ms: number) => { const m = Math.floor(ms / 60_000), s = Math.round((ms % 60_000) / 1000); return `${m} min ${String(s).padStart(2, "0")}`; };
  const LEGENDS = [
    { k: "france", nom: "Toute la France", desc: "Les 303 étoiles : 100 % de « Ta France »" },
    { k: "argent", nom: "Tout en argent", desc: "Les 101 départements retenus dans la durée" },
    { k: "or", nom: "Tout en or", desc: "Avec toutes les sous-préfectures et tous les voisins" },
  ] as const;

  /** Lance un Marathon : les 101 en fiche complète, au clavier (réglages de l'Entraînement). */
  function marathon() {
    try { localStorage.setItem("hexa.training", JSON.stringify({ zone: "france", region: "", give: ["nom", "numero", "carte"], ask: ["carte", "nom", "numero", "prefecture"], length: "all", input: "libre" })); } catch { /* navigation privée */ }
    nav.go({ name: "training" });
  }
</script>

<main class="hof page">
  <header>
    <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
    <div class="seg">
      <button class:on={tab === "defi"} onclick={() => (tab = "defi")}>Défi du jour</button>
      <button class:on={tab === "marathon"} onclick={() => (tab = "marathon")}>Marathon</button>
      <button class:on={tab === "legendes"} onclick={() => (tab = "legendes")}>Légendes</button>
    </div>
  </header>
  <div class="head"><Mascot mood="wow" size={58} /><div><h1 class="title">Hall of Fame</h1><p>Les meilleurs joueurs d'Hexa. {session.me ? "" : "Il faut un compte pour y figurer."}</p></div></div>

  {#if failed}<p class="hint">Le Hall of Fame n'est pas joignable pour le moment.</p>
  {:else if !hof}<p class="hint">Chargement…</p>
  {:else if tab === "defi"}
    <div class="filters">
      <div class="seg">
        <button class:on={period === "week"} onclick={() => (period = "week")}>Cette semaine</button>
        <button class:on={period === "month"} onclick={() => (period = "month")}>Ce mois-ci</button>
      </div>
      <div class="seg">{#each LEVELS as l (l)}<button class:on={level === l} onclick={() => (level = l)}>{LEVEL_NAMES[l]}</button>{/each}</div>
    </div>
    <p class="hint">Points cumulés au défi du jour en {LEVEL_NAMES[level]}, depuis le {day(period === "week" ? hof.daily.since.week : hof.daily.since.month)}.</p>
    <ol class="lb">
      {#each hof.daily[period][level] as p, i (i)}
        <li class:me={p.name === me}><span class="pos tabnum">{i + 1}</span><span class="nm">{p.name}{p.home ? ` · ${p.home}` : ""}</span><small>{p.days} défi{p.days > 1 ? "s" : ""}</small><b class="tabnum">{p.points.toLocaleString("fr-FR")}</b></li>
      {:else}<li class="empty">Personne encore à ce niveau. Joue le défi du jour pour ouvrir le classement.</li>{/each}
    </ol>
  {:else if tab === "marathon"}
    <p class="hint">Les 101 départements d'affilée en fiche complète (le placer, le nom, le numéro, la préfecture), au clavier. La justesse d'abord, le temps ensuite. Ton meilleur Marathon est gardé.</p>
    <ol class="lb">
      {#each hof.marathon as p, i (i)}
        <li class:me={p.name === me}><span class="pos tabnum">{i + 1}</span><span class="nm">{p.name}{p.home ? ` · ${p.home}` : ""}</span><small class="tabnum">{dur(p.elapsedMs)}</small><b class="tabnum">{Math.round(p.accuracy * 1000) / 10} %</b></li>
      {:else}<li class="empty">Aucun Marathon encore. Le premier nom gravé ici sera peut-être le tien.</li>{/each}
    </ol>
    <button class="btn big" onclick={marathon}>Lancer un Marathon</button>
  {:else}
    <div class="legends">
      {#each LEGENDS as L (L.k)}
        <section class="card leg {L.k}">
          <h2>{L.nom}</h2><p class="hint">{L.desc}</p>
          <ol class="lb">
            {#each hof.legends[L.k] as p, i (i)}
              <li class:me={p.name === me}><span class="pos tabnum">{i + 1}</span><span class="nm">{p.name}</span><small>{fmt(p.at)}</small></li>
            {:else}<li class="empty">Personne encore.</li>{/each}
          </ol>
        </section>
      {/each}
    </div>
  {/if}
</main>

<style>
  .hof { --w: 900px; display: flex; flex-direction: column; gap: 16px; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .head { display: flex; gap: 14px; align-items: center; }
  .head p { margin: 0; color: var(--soft); font-weight: 600; }
  .filters { display: flex; gap: 10px; flex-wrap: wrap; }
  .hint { margin: 0; font-size: 14px; color: var(--soft); font-weight: 600; }
  .lb { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .lb li { display: grid; grid-template-columns: 30px 1fr auto auto; gap: 10px; align-items: baseline; padding: 8px 12px; border-radius: 12px; background: #fff; font-weight: 700; }
  .lb li:nth-child(-n + 3) .pos { color: var(--pink-d); }
  .lb li.me { background: var(--yellow); }
  .lb li small { color: var(--soft); font-weight: 700; font-size: 13px; }
  .lb li b { font-weight: 900; }
  .lb li.empty { display: block; background: transparent; color: var(--soft); font-weight: 600; }
  .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .legends { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .leg { display: flex; flex-direction: column; gap: 8px; }
  .leg h2 { margin: 0; font-size: 18px; font-weight: 900; }
  .leg.france { box-shadow: inset 0 0 0 2px #e6b98e; }
  .leg.argent { box-shadow: inset 0 0 0 2px #b4bfcd; }
  .leg.or { box-shadow: inset 0 0 0 2px #f5c518; }
  .leg .lb li { grid-template-columns: 24px 1fr auto; background: var(--bg); }
  .btn.big { align-self: flex-start; }
  @media (max-width: 760px) { .legends { grid-template-columns: 1fr; } header .seg button { padding-inline: 9px; } }
</style>
