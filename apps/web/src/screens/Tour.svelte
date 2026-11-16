<script lang="ts">
  import { DEP, OM_UNLOCK_STARS, OUTRE_MER, TOUR, TOUR_REGIONS, mastery, nextTourRegion, randomSeed, totalStars, tourRegionOf, tourState, DEPARTEMENTS, medalOf } from "@hexa/game";
  import Map from "../lib/Map.svelte";
  import Stars from "../lib/ui/Stars.svelte";
  import Vignette from "../lib/ui/Vignette.svelte";
  import Icon from "../lib/ui/Icon.svelte";
  import Mascot from "../lib/ui/Mascot.svelte";
  import { nav, inputPref } from "../lib/nav.svelte.ts";
  import { profile } from "../lib/profile.svelte.ts";
  import { progress } from "../lib/progress.svelte.ts";
  import { session } from "../lib/api.svelte.ts";
  import { sound } from "../lib/sound.svelte.ts";

  let { region }: { region?: string } = $props();
  const p = $derived(profile.data);
  const choosing = $derived(!p.tourStart);
  const homeRegion = $derived(session.me?.home ? tourRegionOf(session.me.home)?.code : null);
  // svelte-ignore state_referenced_locally
  let sel = $state<string | null>(region ?? null);
  $effect(() => { if (!sel) sel = p.tourStart ? (nextTourRegion(p)?.code ?? null) : homeRegion ?? null; });

  const beginner = mastery(progress.data, DEPARTEMENTS.map((d) => d.code)) < 30;
  let input = $state<"choix" | "libre">(inputPref.get() ?? (beginner ? "choix" : "libre"));
  $effect(() => inputPref.set(input));

  const STAR_FILL = ["", "#cfe5f7", "#6fb0e6", "var(--blue)"];
  const fills = $derived.by(() => {
    const f: Record<string, string> = {};
    for (const r of TOUR_REGIONS) {
      const st = tourState(p, r.code);
      const color = r.code === sel ? "var(--yellow)" : st === "locked" ? "#ebe5d8" : STAR_FILL[p.stars[r.code] ?? 0] || "#fffdf8";
      for (const c of r.deps) f[c] = color;
    }
    return f;
  });

  const cur = $derived(sel ? TOUR.get(sel) ?? null : null);
  const curState = $derived(cur ? tourState(p, cur.code) : "locked");
  const stars = $derived(cur ? p.stars[cur.code] ?? 0 : 0);
  const ordered = $derived([...TOUR_REGIONS].sort((a, b) => {
    const rank = (c: string) => (tourState(p, c) === "locked" ? 2 : (p.stars[c] ?? 0) >= 3 ? 1 : 0);
    return rank(a.code) - rank(b.code) || (p.stars[b.code] ?? 0) - (p.stars[a.code] ?? 0) || a.nom.localeCompare(b.nom, "fr");
  }));

  function pick(code: string) { sound.play("tap"); sel = tourRegionOf(code).code; }
  function start(level: "normal" | "expert") {
    if (!cur) return;
    if (choosing) profile.setTourStart(cur.code);
    nav.go({ name: "play", mode: "tour", region: cur.code, learn: true, title: cur.nom, config: { seed: randomSeed(), level, input, codes: cur.deps } });
  }
  function lockReason(code: string) {
    if (code === OUTRE_MER) return `Débloqué à ${OM_UNLOCK_STARS} étoiles (${totalStars(p)}/${OM_UNLOCK_STARS})`;
    return "Gagne une étoile dans une région voisine";
  }
</script>

<main class="tour">
  <header>
    <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
    <h1 class="title">Tour de France</h1>
    <span class="chip"><Icon name="star" /> {totalStars(p)} / {TOUR_REGIONS.length * 3}</span>
  </header>

  {#if choosing}
    <div class="intro"><Mascot mood="happy" size={56} /><p class="bubble">Choisis ta région de départ{homeRegion ? " (ta région de cœur est surlignée)" : ""}. Chaque région où tu gagnes une étoile ouvre ses voisines.</p></div>
  {/if}

  <div class="grid">
    <section class="mapcol"><Map {fills} onpick={pick} label="Carte du Tour de France" /></section>

    <aside>
      {#if cur}
        <div class="card detail">
          <div class="dhead">
            <h2>{cur.nom}</h2>
            <Stars n={stars} size={26} />
          </div>
          {#if curState === "locked"}
            <p class="lock"><Icon name="lock" /> {lockReason(cur.code)}</p>
          {:else}
            <ul class="goals">
              <li class:got={stars >= 1}><Icon name="star" size={16} /> Terminer avec 60 % de bonnes réponses</li>
              <li class:got={stars >= 2}><Icon name="star" size={16} /> Sans aucune faute</li>
              <li class:got={stars >= 3}><Icon name="star" size={16} /> En expert, 90 % ou plus (sous-préfectures et voisins)</li>
            </ul>
            <div class="plates">{#each cur.deps as c (c)}<Vignette code={c} tier={medalOf(p.know ?? {}, c)} size="s" />{/each}</div>
            <div class="seg" role="group" aria-label="Façon de répondre">
              <button class:on={input === "choix"} onclick={() => (input = "choix")}>4 propositions</button>
              <button class:on={input === "libre"} onclick={() => (input = "libre")}>Au clavier</button>
            </div>
            <div class="go">
              <button class="btn big" onclick={() => start("normal")}>{choosing ? "Partir d'ici" : stars ? "Rejouer" : "Jouer"} · {cur.deps.length} dép.</button>
              <button class="btn ink" onclick={() => start("expert")} disabled={stars < 1 && !choosing}>Expert ★★★</button>
            </div>
            {#if stars < 1 && !choosing}<p class="hint">Le mode expert s'ouvre après la première étoile.</p>{/if}
          {/if}
        </div>
      {:else}
        <p class="hint">Touche une région sur la carte.</p>
      {/if}

      <div class="list">
        {#each ordered as r (r.code)}
          {@const st = tourState(p, r.code)}
          <button class="reg" class:lock={st === "locked"} class:cur={r.code === sel} onclick={() => (sel = r.code)}>
            <span class="nm">{r.nom}{#if r.code === homeRegion}<small> · ta région</small>{/if}</span>
            {#if st === "locked"}<Icon name="lock" />{:else}<Stars n={p.stars[r.code] ?? 0} size={18} />{/if}
          </button>
        {/each}
      </div>
    </aside>
  </div>
</main>

<style>
  .tour { max-width: 1320px; margin: 0 auto; padding: 16px 20px 32px; display: flex; flex-direction: column; gap: 14px; }
  header { display: flex; align-items: center; gap: 14px; }
  header h1 { margin-right: auto; font-size: clamp(26px, 4vw, 36px); }
  .intro { display: flex; gap: 12px; align-items: flex-start; max-width: 720px; }
  .intro .bubble { flex: 1; }
  .grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr); gap: 24px; align-items: start; }
  .mapcol { position: sticky; top: 12px; }
  aside { display: flex; flex-direction: column; gap: 14px; }
  .detail { display: flex; flex-direction: column; gap: 12px; animation: pop-in .25s ease-out; }
  .dhead { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .dhead h2 { font-size: 24px; font-weight: 900; }
  .goals { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-weight: 600; color: var(--soft); font-size: 14.5px; }
  .goals li { display: flex; gap: 8px; align-items: center; }
  .goals li:not(.got) :global(svg) { filter: grayscale(1); opacity: .45; }
  .goals li.got { color: var(--ink); }
  .plates { display: flex; flex-wrap: wrap; gap: 6px; }
  .go { display: flex; gap: 10px; flex-wrap: wrap; }
  .go .btn.big { flex: 1; }
  .lock { font-weight: 700; color: var(--soft); display: flex; gap: 8px; align-items: center; }
  .hint { color: var(--soft); font-weight: 600; font-size: 14px; }
  .list { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .reg { display: flex; justify-content: space-between; align-items: center; gap: 8px; text-align: left; background: #fff; border: 0; border-radius: 14px; padding: 10px 12px; cursor: pointer; font-weight: 800; font-size: 14.5px; box-shadow: 0 3px 0 var(--line); }
  .reg small { color: var(--soft); font-weight: 600; }
  .reg.lock { background: transparent; box-shadow: none; border: 2px dashed #d7cfbe; color: var(--soft); }
  .reg.cur { outline: 3px solid var(--yellow); outline-offset: -3px; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } .mapcol { position: static; } .list { grid-template-columns: 1fr; } }
</style>
