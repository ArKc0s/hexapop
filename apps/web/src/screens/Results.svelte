<script lang="ts">
  import { onMount } from "svelte";
  import { BADGE, TOUR, levelInfo, nextTourRegion, questsFor, dayKey, QUEST_POOL, randomSeed, type Question, type RoundResult, type Rewards } from "@hexa/game";
  import Map, { type Mark } from "../lib/Map.svelte";
  import Fiche from "../lib/Fiche.svelte";
  import Stars from "../lib/ui/Stars.svelte";
  import Vignette from "../lib/ui/Vignette.svelte";
  import Mascot from "../lib/ui/Mascot.svelte";
  import Icon from "../lib/ui/Icon.svelte";
  import { nav, type PlayScreen } from "../lib/nav.svelte.ts";
  import { profile } from "../lib/profile.svelte.ts";
  import { sound } from "../lib/sound.svelte.ts";
  import { rankFor } from "../lib/rank.ts";
  import { DEPARTEMENTS, mastery } from "@hexa/game";
  import { progress } from "../lib/progress.svelte.ts";
  import SaveCard from "../lib/ui/SaveCard.svelte";

  let { play, results, rewards }: { play: PlayScreen; questions: Question[]; results: RoundResult[]; rewards: Rewards } = $props();

  // svelte-ignore state_referenced_locally
  const r = rewards;
  const total = results.reduce((n, x) => n + x.points, 0);
  const perfect = results.filter((x) => x.accuracy >= 0.999).length;
  const missed = results.filter((x) => x.accuracy < 0.999);
  const marks: Record<string, Mark> = Object.fromEntries(results.map((x) => [x.code, x.accuracy >= 0.999 ? "done-ok" : "done-ko"]));
  let focus = $state<string | null>(missed[0]?.code ?? null);

  const before = levelInfo(r.xpBefore), after = levelInfo(r.xpBefore + r.xp);
  const levelUp = r.levelAfter > r.levelBefore;
  const rank = rankFor(mastery(progress.data, DEPARTEMENTS.map((d) => d.code))).name;
  let xpWidth = $state(before.ratio * 100);
  onMount(() => {
    setTimeout(() => { xpWidth = levelUp ? 100 : after.ratio * 100; sound.play(levelUp ? "level" : "tick"); }, 700);
    if (levelUp) setTimeout(() => (xpWidth = after.ratio * 100), 1500);
    if (r.stars && r.stars.after > r.stars.before) setTimeout(() => sound.play("star"), 300);
  });

  const quests = questsFor(dayKey(Date.now()));
  const questLabel = (id: string) => QUEST_POOL.find((q) => q.id === id)?.label ?? id;
  const regionName = r.stars ? TOUR.get(r.stars.region)?.nom : null;
  const next = play.mode === "tour" ? nextTourRegion(profile.data) : null;

  const mood = perfect === results.length ? "wow" : perfect >= results.length / 2 ? "happy" : "think";
  const headline = r.stars && r.stars.after > r.stars.before ? (r.stars.after === 3 ? "Région maîtrisée !" : "Nouvelle étoile !")
    : perfect === results.length ? "Sans faute !" : perfect >= results.length / 2 ? "Belle partie !" : "Ça rentre petit à petit.";

  function replay(codes?: string[]) {
    nav.go({ ...play, config: { ...play.config, seed: randomSeed(), ...(codes ? { codes, rounds: undefined } : {}) } });
  }
</script>

<main class="res">
  <section class="hero">
    {#if r.stars}
      <Stars n={r.stars.after} size={58} animate />
      <span class="k">{regionName}</span>
    {/if}
    <div class="head"><Mascot {mood} size={64} /><h1 class="title">{headline}</h1></div>
    <span class="riso score" data-t={total.toLocaleString("fr-FR")}>{total.toLocaleString("fr-FR")}</span>
    <p class="sub">{perfect} sur {results.length} sans faute{r.bestCombo >= 2 ? ` · meilleur combo ×${r.bestCombo}` : ""}</p>

    <div class="xp">
      <div class="xprow"><b>Niveau {levelUp ? r.levelAfter : r.levelBefore} · {rank}</b><b class="gain">+{r.xp} XP</b></div>
      <div class="bar big"><i style="width:{xpWidth}%"></i></div>
      {#if levelUp}<p class="lvl">Niveau {r.levelAfter} atteint !</p>{/if}
    </div>

    <div class="rewards">
      {#if r.streak.extended}
        <div class="rw"><span class="ico flame"><Icon name="flame" size={26} /></span><div><span class="k">Série</span><b>{r.streak.count} jour{r.streak.count > 1 ? "s" : ""} d'affilée{r.streak.jokerUsed ? " (joker utilisé)" : ""}</b></div></div>
      {/if}
      {#each r.newBadges as id (id)}
        <div class="rw"><span class="ico badge"><Icon name="trophy" size={26} /></span><div><span class="k">Badge débloqué</span><b>{BADGE.get(id)?.nom}</b><small>{BADGE.get(id)?.desc}</small></div></div>
      {/each}
      {#each r.questsDone as id (id)}
        <div class="rw"><span class="ico quest"><Icon name="check" size={24} /></span><div><span class="k">Quête du jour · +50 XP</span><b>{questLabel(id)}</b></div></div>
      {/each}
      {#if r.upgrades.length}
        {@const tierName = ["", "bronze", "argent", "or"][r.upgrades[0].tier]}
        <div class="rw plates"><div><span class="k">{r.upgrades.length} vignette{r.upgrades.length > 1 ? "s" : ""} {tierName}{r.newPlates.length ? ` · ${r.newPlates.length} nouvelle${r.newPlates.length > 1 ? "s" : ""}` : ""}</span>
          <div class="pl">{#each r.upgrades.slice(0, 8) as u (u.code)}<Vignette code={u.code} tier={u.tier} size="s" />{/each}{#if r.upgrades.length > 8}<span class="more">+{r.upgrades.length - 8}</span>{/if}</div></div></div>
      {/if}
    </div>

    <div class="cta">
      {#if play.mode === "tour"}
        {#if (r.stars?.after ?? 0) < 1}
          <button class="btn big" onclick={() => replay()}>Réessayer {regionName}</button>
        {:else if next && next.code !== play.region}
          <button class="btn big" onclick={() => nav.go({ name: "tour", region: next.code })}>Région suivante : {next.nom}</button>
        {/if}
        <button class="btn white big" onclick={() => nav.go({ name: "tour", region: play.region })}>Retour au Tour</button>
      {:else}
        {#if missed.length}<button class="btn big" onclick={() => replay(missed.map((x) => x.code))}>Rejouer les {missed.length} ratés</button>{/if}
        <button class="btn white big" onclick={() => replay()}>Rejouer</button>
      {/if}
      <button class="link" onclick={() => nav.go({ name: "home" })}>Accueil</button>
    </div>
    <SaveCard then={{ name: "home" }} />
    <p class="quests k">Quêtes du jour : {quests.filter((q) => (profile.data.quests.progress[q.id] ?? 0) >= q.target).length}/3</p>
  </section>

  <section class="review">
    <Map {marks} interactive onpick={(c) => (focus = c)} label="Bilan de la partie" />
    {#if missed.length}
      <div class="missed">
        <span class="k">À revoir</span>
        <div class="list">{#each missed as x (x.code)}<button class="chip" class:on={focus === x.code} onclick={() => (focus = x.code)}>{x.code} · {DEPARTEMENTS.find((d) => d.code === x.code)?.nom}</button>{/each}</div>
      </div>
    {/if}
    {#if focus}<Fiche code={focus} />{/if}
  </section>
</main>

<style>
  .res { max-width: 1240px; margin: 0 auto; padding: 24px 20px 48px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px; align-items: start; }
  .hero { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 10px 0; }
  .head { display: flex; align-items: center; gap: 12px; }
  .score { font-size: clamp(64px, 9vw, 96px); }
  .sub { color: var(--soft); font-weight: 700; }
  .xp { width: min(460px, 100%); display: flex; flex-direction: column; gap: 6px; text-align: left; }
  .xprow { display: flex; justify-content: space-between; }
  .gain { color: var(--green-d); }
  .bar.big { height: 16px; }
  .bar.big i { background: linear-gradient(90deg, var(--green), #5fd6a4); transition: width 1.2s cubic-bezier(.2, .8, .2, 1); }
  .lvl { font-weight: 900; color: var(--green-d); animation: pop-in .4s cubic-bezier(.2, 1.6, .4, 1); }
  .rewards { width: min(460px, 100%); display: flex; flex-direction: column; gap: 8px; }
  .rw { background: #fff; border-radius: 18px; padding: 12px 14px; display: flex; gap: 12px; align-items: center; text-align: left; box-shadow: 0 4px 0 var(--line); animation: pop-in .4s cubic-bezier(.2, 1.4, .4, 1) both; }
  .rw:nth-child(2) { animation-delay: .1s; } .rw:nth-child(3) { animation-delay: .2s; } .rw:nth-child(4) { animation-delay: .3s; }
  .rw > div { display: flex; flex-direction: column; gap: 2px; }
  .rw small { color: var(--soft); font-size: 13px; }
  .ico { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; flex: none; }
  .flame { background: #ffe8d6; }
  .badge { background: var(--yellow); box-shadow: 0 3px 0 var(--yellow-d); color: var(--ink); }
  .quest { background: var(--green); color: #fff; box-shadow: 0 3px 0 var(--green-d); }
  .pl { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .more { font-weight: 800; align-self: center; }
  .cta { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; align-items: center; }
  .review { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 12px; }
  .missed { display: flex; flex-direction: column; gap: 6px; }
  .list { display: flex; flex-wrap: wrap; gap: 6px; }
  @media (max-width: 900px) { .res { grid-template-columns: 1fr; } .review { position: static; } }
  @media (min-width: 901px) { .res { min-height: 100dvh; align-content: center; } }
</style>
