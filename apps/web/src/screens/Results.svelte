<script lang="ts">
  import RoadBar from "../lib/ui/RoadBar.svelte";
  import { tripEvents } from "@hexa/game";
  import { onMount, onDestroy } from "svelte";
  import { BADGE, TOUR, nextTourRegion, randomSeed, type Question, type RoundResult, type Rewards } from "@hexa/game";
  import { startSeance } from "../lib/seance.svelte.ts";
  import Map, { type Mark } from "../lib/Map.svelte";
  import Fiche from "../lib/Fiche.svelte";
  import Stars from "../lib/ui/Stars.svelte";
  import Vignette from "../lib/ui/Vignette.svelte";
  import Mascot from "../lib/ui/Mascot.svelte";
  import Icon from "../lib/ui/Icon.svelte";
  import { nav, type PlayScreen } from "../lib/nav.svelte.ts";
  import { profile } from "../lib/profile.svelte.ts";
  import { sound } from "../lib/sound.svelte.ts";
  import { DEPARTEMENTS, DEP, MEDAL_NAMES, taFrance, titleFor, type Facet } from "@hexa/game";
  import SaveCard from "../lib/ui/SaveCard.svelte";
  import { signup } from "../lib/signup.svelte.ts";
  import PushCard from "../lib/ui/PushCard.svelte";
  import { api, session } from "../lib/api.svelte.ts";
  import type { InputMode } from "@hexa/game";

  let { play, results, rewards, input }: { play: PlayScreen; questions: Question[]; results: RoundResult[]; rewards: Rewards; input?: InputMode } = $props();

  // Marathon : les 101 en fiche complète (le placer, le numéro, la préfecture), au clavier -> Hall of Fame.
  // svelte-ignore state_referenced_locally
  const marathon = play.mode === "marathon" && results.length === 101 && (["carte", "numero", "prefecture"] as const).every((f) => play.config.ask?.includes(f));
  type HofResult = { record: boolean; best: { accuracy: number; elapsedMs: number }; rank: number; players: number };
  let hof = $state<HofResult | "guest" | "choix" | "error" | null>(null);
  const mAccuracy = results.reduce((n, x) => n + x.accuracy, 0) / Math.max(1, results.length);
  const mElapsed = results.reduce((n, x) => n + x.elapsedMs, 0);
  const dur = (ms: number) => { const m = Math.floor(ms / 60_000), s = Math.round((ms % 60_000) / 1000); return m ? `${m} min ${String(s).padStart(2, "0")} s` : `${s} s`; };
  onMount(() => {
    if (!marathon) return;
    if (input !== "libre") hof = "choix";
    else if (!session.me) hof = "guest";
    else api<HofResult>("POST", "/marathon", { accuracy: mAccuracy, elapsedMs: mElapsed, rounds: results.length }).then((h) => (hof = h)).catch(() => (hof = "error"));
  });

  // svelte-ignore state_referenced_locally
  const r = rewards;
  const total = results.reduce((n, x) => n + x.points, 0);
  const perfect = results.filter((x) => x.accuracy >= 0.999).length;
  // Un département peut revenir deux fois dans une séance (question puis rappel) : on garde sa dernière réponse.
  // (Deux entrées pour le même département faisaient planter la liste « À revoir », et le bilan ne s'ouvrait pas.)
  const last = [...new globalThis.Map(results.map((x) => [x.code, x] as const)).values()];
  const missed = last.filter((x) => x.accuracy < 0.999);
  const marks: Record<string, Mark> = Object.fromEntries(results.map((x) => [x.code, x.accuracy >= 0.999 ? "done-ok" : "done-ko"]));
  let focus = $state<string | null>(missed[0]?.code ?? null);

  const rank = titleFor(profile.data.know ?? {}).name;
  // Étoiles gagnées, regroupées par département (« Finistère : placer, numéro »).
  const FACET_LABEL: Record<Facet, string> = { carte: "placer", numero: "numéro", prefecture: "préfecture", sousPrefectures: "sous-préfectures", limitrophes: "voisins" };
  const starList = (() => {
    const by = new globalThis.Map<string, Facet[]>();
    for (const s of r.knowledge?.stars ?? []) by.set(s.code, [...(by.get(s.code) ?? []), s.facet]);
    return [...by].map(([code, facets]) => ({ code, facets }));
  })();
  const newStars = r.knowledge?.stars.length ?? 0;
  const pctNow = taFrance(profile.data.know ?? {});
  // Quitter l'écran avant l'invitation l'annule (elle ne doit jamais surgir pendant la partie suivante).
  let offerTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(offerTimer));
  onMount(() => {
    setTimeout(() => sound.play("tick"), 700);
    if (r.stars && r.stars.after > r.stars.before) setTimeout(() => sound.play("star"), 300);
    // Invité : on laisse voir les récompenses, puis on propose de les garder.
    // Un vrai moment rend la sauvegarde évidente : on le nomme.
    const medals = r.knowledge?.medals ?? [];
    const moment = medals.length ? (medals.length === 1 ? `ta médaille ${["", "de bronze", "d'argent", "d'or"][medals[0].medal]}` : `tes ${medals.length} médailles`)
      : passed.voyages.length ? `ton grand voyage (${passed.voyages[0]})`
      : r.streak.extended && [2, 3, 7, 14, 30, 50, 100].includes(r.streak.count) ? `ta série de ${r.streak.count} jours`
      : undefined;
    offerTimer = setTimeout(() => signup.offer({ kind: "solo", xp: r.xp, stars: newStars, firstGame: profile.data.stats.games <= 1, moment, games: profile.data.stats.games }), 1000);
  });

  const weekKm = profile.data.week?.km ?? r.xp;
  const passed = tripEvents(profile.data.xp - r.xp, profile.data.xp);
  const regionName = r.stars ? TOUR.get(r.stars.region)?.nom : null;
  const next = play.mode === "tour" ? nextTourRegion(profile.data) : null;

  const mood = perfect === results.length ? "wow" : perfect >= results.length / 2 ? "happy" : "think";
  const headline = r.stars && r.stars.after > r.stars.before ? (r.stars.after === 3 ? "Région maîtrisée !" : "Nouvelle étoile !")
    : perfect === results.length ? "Sans faute !" : perfect >= results.length / 2 ? "Belle partie !" : "Ça rentre petit à petit.";

  /** « Rejouer les ratés » : seulement ceux-là, en gardant la configuration de départ.
   *  « Rejouer » : toujours la partie de départ (pas la dernière série de ratés). */
  const origin = play.origin ?? play.config;
  function replay(codes?: string[]) {
    if (codes) nav.go({ ...play, origin, config: { ...origin, seed: randomSeed(), codes, rounds: undefined } });
    else nav.go({ ...play, origin: undefined, config: { ...origin, seed: randomSeed() } });
  }
</script>

<main class="res page">
  <section class="hero">
    {#if r.stars}
      <Stars n={r.stars.after} size={58} animate />
      <span class="k">{regionName}</span>
    {/if}
    <div class="head"><Mascot {mood} size={64} /><h1 class="title">{headline}</h1></div>
    <span class="riso score" data-t={total.toLocaleString("fr-FR")}>{total.toLocaleString("fr-FR")}</span>
    <p class="sub">{perfect} sur {results.length} sans faute{r.bestCombo >= 2 ? ` · meilleur combo ×${r.bestCombo}` : ""}</p>

    <div class="km">
      <b class="gain tabnum">+{r.xp.toLocaleString("fr-FR")} km</b>
      <RoadBar km={profile.data.xp} gain={r.xp} />
      {#if passed.voyages.length}<span class="stop">Grand voyage terminé : <b>{passed.voyages.join(", ")}</b> !</span>
      {:else if passed.cities.length}<span class="stop">Hexa est arrivé à <b>{passed.cities.join(", ")}</b> !</span>{/if}
      <span class="tabnum">{weekKm.toLocaleString("fr-FR")} km cette semaine · {rank}</span>
    </div>

    {#if marathon && hof}
      <div class="card hofc">
        <span class="k">Marathon · Hall of Fame</span>
        <b class="tabnum">{Math.round(mAccuracy * 100)} % en {dur(mElapsed)}</b>
        {#if hof === "guest"}<p>Crée un compte pour entrer au Hall of Fame du Marathon.</p>
        {:else if hof === "choix"}<p>Le Hall of Fame du Marathon se joue au clavier, sans propositions.</p>
        {:else if hof === "error"}<p>Ton résultat n'a pas pu être enregistré.</p>
        {:else}
          <p>{hof.record ? "Nouveau record personnel ! " : `Ton record : ${Math.round(hof.best.accuracy * 100)} % en ${dur(hof.best.elapsedMs)}. `}<b>{hof.rank}{hof.rank === 1 ? "er" : "e"}</b> sur {hof.players}.</p>
        {/if}
        <button class="link" onclick={() => nav.go({ name: "hof" })}>Voir le Hall of Fame</button>
      </div>
    {/if}

    <div class="rewards">
      {#if r.streak.extended}
        <div class="rw"><span class="ico flame"><Icon name="flame" size={26} /></span><div><span class="k">Série</span><b>{r.streak.count} jour{r.streak.count > 1 ? "s" : ""} d'affilée{r.streak.jokerUsed ? " (joker utilisé)" : ""}</b></div></div>
      {/if}
      {#each r.newBadges as id (id)}
        <div class="rw"><span class="ico badge"><Icon name="trophy" size={26} /></span><div><span class="k">Badge débloqué</span><b>{BADGE.get(id)?.nom}</b><small>{BADGE.get(id)?.desc}</small></div></div>
      {/each}
      {#if r.knowledge?.medals.length}
        <div class="rw plates"><div><span class="k">{r.knowledge.medals.length === 1 ? "Nouvelle médaille" : `${r.knowledge.medals.length} nouvelles médailles`}</span>
          <div class="pl">{#each r.knowledge.medals.slice(0, 8) as m (m.code)}<span class="md"><Vignette code={m.code} tier={m.medal} size="s" /><small>{MEDAL_NAMES[m.medal]}</small></span>{/each}{#if r.knowledge.medals.length > 8}<span class="more">+{r.knowledge.medals.length - 8}</span>{/if}</div></div></div>
      {/if}
      {#if newStars}
        <div class="rw"><span class="ico star"><Icon name="star" size={28} /></span><div><span class="k">+{newStars} étoile{newStars > 1 ? "s" : ""} · Ta France {pctNow} %</span>
          <ul class="sl">{#each starList.slice(0, 6) as s (s.code)}<li><b>{DEP.get(s.code)?.nom}</b> {s.facets.map((f) => FACET_LABEL[f]).join(", ")}</li>{/each}{#if starList.length > 6}<li class="more">et {starList.length - 6} autre{starList.length - 6 > 1 ? "s" : ""}</li>{/if}</ul></div></div>
      {:else if play.learn && r.knowledge}
        <div class="rw"><span class="ico star dim"><Icon name="star" size={28} /></span><div><span class="k">Pas de nouvelle étoile</span><small>Une étoile se gagne en répondant juste sans qu'on t'aide : au clavier, sur la carte, ou parmi des propositions qui se ressemblent. La première rencontre avec un département ne compte pas encore.</small></div></div>
      {/if}
    </div>

    <div class="cta">
      {#if play.mode === "seance"}
        <button class="btn big" onclick={() => startSeance()}>Séance suivante</button>
      {:else}
        {#if missed.length}<button class="btn big" onclick={() => replay(missed.map((x) => x.code))}>Rejouer les {missed.length} ratés</button>{/if}
        <button class="btn white big" onclick={() => replay()}>{play.origin ? "Nouvelle partie" : "Rejouer"}</button>
      {/if}
      {#if play.mode === "eclair" || play.mode === "region" || play.mode === "marathon"}<button class="link" onclick={() => nav.go({ name: "training" })}>Changer les réglages</button>{/if}
      <button class="link" onclick={() => nav.go({ name: "home" })}>Accueil</button>
    </div>
    <SaveCard then={{ name: "home" }} />
    <PushCard />
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
  .res { --w: 1240px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px; align-items: start; }
  .hero { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 10px 0; }
  .head { display: flex; align-items: center; gap: 12px; }
  .score { font-size: clamp(64px, 9vw, 96px); }
  .sub { color: var(--soft); font-weight: 700; }
  .km { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .km .gain { font-size: 22px; font-weight: 900; }
  .km { width: min(100%, 420px); }
  .km > span { color: var(--soft); font-weight: 700; font-size: 14px; }
  .km .stop { color: var(--ink); background: #fff4c2; border-radius: 999px; padding: 3px 12px; }
  .gain { color: var(--green-d); }
  .rewards { width: min(460px, 100%); display: flex; flex-direction: column; gap: 8px; }
  .rw { background: #fff; border-radius: 18px; padding: 12px 14px; display: flex; gap: 12px; align-items: center; text-align: left; box-shadow: 0 4px 0 var(--line); animation: pop-in .4s cubic-bezier(.2, 1.4, .4, 1) both; }
  .rw:nth-child(2) { animation-delay: .1s; } .rw:nth-child(3) { animation-delay: .2s; } .rw:nth-child(4) { animation-delay: .3s; }
  .rw > div { display: flex; flex-direction: column; gap: 2px; }
  .rw small { color: var(--soft); font-size: 13px; }
  .ico { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; flex: none; }
  .flame { background: #ffe8d6; }
  .badge { background: var(--yellow); box-shadow: 0 3px 0 var(--yellow-d); color: var(--ink); }
  .pl { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .md { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; }
  .md small { font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
  .star { background: #fff4c2; box-shadow: 0 3px 0 var(--yellow-d); }
  .star.dim { filter: grayscale(1); opacity: .6; }
  .sl { list-style: none; margin: 2px 0 0; padding: 0; font-size: 14px; color: var(--soft); font-weight: 600; }
  .sl b { color: var(--ink); font-weight: 800; }
  .more { font-weight: 800; align-self: center; }
  .cta { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; align-items: center; }
  .review { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 12px; }
  .missed { display: flex; flex-direction: column; gap: 6px; }
  .list { display: flex; flex-wrap: wrap; gap: 6px; }
  @media (max-width: 900px) { .res { grid-template-columns: 1fr; } .review { position: static; } }
  @media (min-width: 901px) { .res { min-height: 100dvh; align-content: center; } }
  .hofc { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; box-shadow: inset 0 0 0 2px var(--yellow); }
  .hofc b { font-size: 20px; font-weight: 900; }
  .hofc p { margin: 0; font-weight: 600; color: var(--soft); }
</style>
