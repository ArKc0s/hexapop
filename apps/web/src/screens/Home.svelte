<script lang="ts">
  import { onDestroy } from "svelte";
  import { DEP, DEPARTEMENTS, MAX_STARS, PLAYER_LEVELS, TOUR, dayKey, fadingCodes, knownStars, liveStreak, medalCount, medalOf, playerLevel, starsOf, taFrance, titleFor, tourRegionOf } from "@hexa/game";
  import Welcome from "../lib/ui/Welcome.svelte";
  import { previewSeance, startSeance } from "../lib/seance.svelte.ts";
  import Map from "../lib/Map.svelte";
  import Mascot from "../lib/ui/Mascot.svelte";
  import Icon from "../lib/ui/Icon.svelte";
  import { nav } from "../lib/nav.svelte.ts";
  import { profile } from "../lib/profile.svelte.ts";
  import { session } from "../lib/api.svelte.ts";
  import { sound } from "../lib/sound.svelte.ts";
  import { install } from "../lib/install.svelte.ts";

  const all = DEPARTEMENTS.map((d) => d.code);
  const p = $derived(profile.data);
  const know = $derived(p.know ?? {});
  const rank = $derived(titleFor(know).name);
  const streak = $derived(liveStreak(p, Date.now()));
  const playedToday = $derived(p.streak.last === dayKey(Date.now()));
  // Premier lancement : « Tu viens d'où ? »
  const welcomed = (() => { try { return !!localStorage.getItem("hexa.welcomed"); } catch { return true; } })();
  const showWelcome = $derived(!welcomed && !p.home && p.stats.games === 0);
  // Prochaine séance (aperçu) et objectif personnel facultatif.
  const seance = $derived(previewSeance());
  const km = $derived(p.xp);
  const todayGames = $derived(p.today?.day === dayKey(Date.now()) ? p.today.games : 0);
  let goal = $state((() => { try { return Number(localStorage.getItem("hexa.goal")) || 0; } catch { return 0; } })());
  function setGoal(g: number) { goal = g; try { localStorage.setItem("hexa.goal", String(g)); } catch { /* */ } }
  const goalDone = $derived(goal > 0 && todayGames >= goal);
  const names = (codes: string[]) => codes.map((c) => DEP.get(c)?.nom).join(", ");
  /** Toucher la carte : la prochaine séance se fait dans cette région. */
  function focusOn(code: string) {
    const r = tourRegionOf(code);
    profile.setFocus(p.focus === r.code ? null : r.code);
    sound.play("tap");
  }
  // « Ta France » : les étoiles (placer, numéro, préfecture) de chaque département, puis ses médailles.
  const fading = $derived(fadingCodes(know, Date.now()));
  const pct = $derived(taFrance(know));
  const stars = $derived(knownStars(know));
  const level = $derived(PLAYER_LEVELS[playerLevel(know)].nom);
  const STAR_FILL = ["", "#dcebf8", "#b6d6f1"];
  const MEDAL_FILL = ["", "#e6b98e", "#b4bfcd", "#f5c518"];
  const fills = $derived(Object.fromEntries(all.flatMap((c) => {
    const m = medalOf(know, c), s = starsOf(know, c);
    if (!s) return know[c] && Object.values(know[c]).some((x) => x?.v) ? [[c, "#eef3f8"]] : [];
    if (fading.includes(c)) return [[c, "var(--tint-ko)"]];
    return [[c, m ? MEDAL_FILL[m] : STAR_FILL[s]]];
  })));

  const hello = $derived.by(() => {
    if (!p.stats.games) return "Salut ! Moi c'est Hexa. Ta première séance t'attend : 2 minutes, promis.";
    if (fading.length >= 3) return `${fading.length} départements pâlissent sur ta carte : ta séance commence par eux.`;
    if (streak > 0 && !playedToday) return `Une séance aujourd'hui pour garder ta série de ${streak} jour${streak > 1 ? "s" : ""} !`;
    if (seance.discover.length) return `Au programme : ${names(seance.discover)}.`;
    if (seance.region) return `On continue en ${seance.region.nom} ?`;
    return `Ta France est à ${pct} %. On consolide ?`;
  });

  function play() {
    sound.play("tap");
    startSeance();
  }

  // Compte à rebours jusqu'au prochain défi (minuit à Paris)
  let now = $state(Date.now());
  const timer = setInterval(() => (now = Date.now()), 1000);
  onDestroy(() => clearInterval(timer));
  const countdown = $derived.by(() => {
    const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const g = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? 0);
    const left = 86400 - (g("hour") * 3600 + g("minute") * 60 + g("second"));
    return `${String(Math.floor(left / 3600)).padStart(2, "0")}:${String(Math.floor((left % 3600) / 60)).padStart(2, "0")}`;
  });
</script>

{#if showWelcome}
<Welcome />
{:else}
<main class="home">
  <section class="left">
    <div class="top">
      <h1 class="riso logo" data-t="HEXA">HEXA</h1>
      <span class="chip" class:gold={goalDone} title={goalDone ? "Objectif du jour atteint !" : "Série de jours joués"}><Icon name="flame" /> {streak}</span>
      <span class="chip km tabnum" title="Kilomètres parcourus">{km.toLocaleString("fr-FR")} km</span>
    </div>
    <!-- Sur mobile, compte et son restent en haut de l'écran -->
    <div class="acc mob">
      {#if session.me}
        <button class="back" onclick={() => nav.go({ name: "account", view: "profile" })}>{session.me.pseudo}</button>
      {:else if session.online}
        <button class="back" onclick={() => nav.go({ name: "account", view: "login" })}>Se connecter</button>
      {/if}
      <button class="snd" onclick={() => sound.toggle()} aria-label={sound.on ? "Couper le son" : "Activer le son"}><Icon name={sound.on ? "sound" : "mute"} /></button>
    </div>

    <div class="hello"><Mascot mood="happy" size={66} /><p class="bubble">{hello}</p></div>

    {#if install.suggest}
      <div class="card install">
        <div><b>Hexa en plein écran</b><p>Ajoute-le à ton écran d'accueil : il s'ouvrira comme une appli, sans barre de navigateur.</p>
          {#if !install.canPrompt && install.ios}<p class="how">{install.iosOther ? "Dans Safari, touche " : "Touche "}<span class="share" aria-label="Partager"><svg width="14" height="16" viewBox="0 0 14 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 11V1M3.5 4.5 7 1l3.5 3.5M4 7H2v10h10V7h-2" /></svg></span> <b>Partager</b>, puis <b>Sur l'écran d'accueil</b>.</p>
            {#if install.iosOther}<p class="how">Si ton navigateur ne le propose pas, ouvre hexapop.app dans Safari pour l'installer.</p>{/if}{/if}
        </div>
        <div class="ia">
          {#if install.canPrompt}<button class="btn small" onclick={() => install.prompt()}>Installer</button>{/if}
          <button class="link" onclick={() => install.dismiss()}>Plus tard</button>
        </div>
      </div>
    {/if}

    <div class="next">
      <button class="btn big wide" onclick={play}>Continuer <Icon name="play" size={20} /></button>
      <small>Séance de 2 min{seance.reviews ? ` · ${seance.reviews} à revoir` : ""}{seance.discover.length ? ` · nouveau : ${names(seance.discover)}` : seance.region ? ` · ${seance.region.nom}` : ""}</small>
      {#if p.focus && TOUR.has(p.focus)}<button class="focus" onclick={() => profile.setFocus(null)}>Région choisie : {TOUR.get(p.focus)?.nom} <span aria-label="Annuler">✕</span></button>{/if}
    </div>

    <div class="row2">
      <button class="btn pink" disabled={!session.online} onclick={() => nav.go({ name: "daily" })}>Défi du jour<small>nouveau dans {countdown}</small></button>
      <button class="btn blue" disabled={!session.online} onclick={() => nav.go({ name: "lobby" })}>Entre amis<small>duel, équipe ou soirée</small></button>
    </div>

    <div class="goal">
      <span class="k">Objectif perso</span>
      <div class="seg">{#each [0, 1, 3, 5] as g (g)}<button class:on={goal === g} onclick={() => setGoal(g)}>{g ? `${g} / jour` : "Aucun"}</button>{/each}</div>
      {#if goal}<span class="gp tabnum" class:ok={goalDone}>{goalDone ? "Atteint !" : `${todayGames}/${goal} aujourd'hui`}</span>{/if}
    </div>

    <nav class="menu" aria-label="Autres modes">
      <button onclick={() => nav.go({ name: "training" })}>Entraînement</button>
      <button onclick={() => nav.go({ name: "album" })}>Album <span>{medalCount(p, 1)}/101</span></button>
      <button onclick={() => nav.go({ name: "atlas" })}>Atlas</button>
      <button onclick={() => nav.go({ name: "rappels" })}>Rappels</button>
    </nav>
  </section>

  <section class="right" aria-label="Ta France">
    <div class="rhead">
      <div><span class="k">Ta France</span><div class="pct tabnum">{pct} %</div><span class="sub tabnum">{stars}/{MAX_STARS} étoiles · niveau {level}</span></div>
      <div class="acc desk">
        {#if session.me}
          <button class="back" onclick={() => nav.go({ name: "account", view: "profile" })}>{session.me.pseudo}</button>
        {:else if session.online}
          <button class="back" onclick={() => nav.go({ name: "account", view: "login" })}>Se connecter</button>
        {/if}
        <button class="snd" onclick={() => sound.toggle()} aria-label={sound.on ? "Couper le son" : "Activer le son"}><Icon name={sound.on ? "sound" : "mute"} /></button>
      </div>
    </div>
    <Map {fills} marks={p.focus && TOUR.has(p.focus) ? Object.fromEntries(TOUR.get(p.focus)!.deps.map((c) => [c, "focus"])) : {}} onpick={focusOn} label="Ta France : touche une région pour y faire ta prochaine séance" />
    <p class="tip">Touche une région pour y faire ta prochaine séance.</p>
    <div class="legend">
      <span><i style="background:#eef3f8; box-shadow: inset 0 0 0 1px #c8d4e0"></i>découvert</span><span><i style="background:#b6d6f1"></i>1-2 étoiles</span><span><i style="background:#e6b98e"></i>bronze</span><span><i style="background:#b4bfcd"></i>argent</span><span><i style="background:#f5c518"></i>or</span>
      <span><i style="background:var(--tint-ko)"></i>à réviser</span>
      {#if fading.length}<button class="link" onclick={() => nav.go({ name: "setup", mode: "apprendre" })}>Réviser ({fading.length})</button>{/if}
    </div>
  </section>

  <footer>
    <button class="link" onclick={() => nav.go({ name: "legal", doc: "mentions" })}>Mentions légales</button>
    <button class="link" onclick={() => nav.go({ name: "legal", doc: "confidentialite" })}>Confidentialité</button>
    <button class="link" onclick={() => nav.go({ name: "legal", doc: "cgu" })}>Conditions d'utilisation</button>
    <a class="link" href="https://github.com/ArKc0s/hexapop/issues/new/choose" target="_blank" rel="noopener">Signaler un bug</a>
    <a class="link" href="https://github.com/ArKc0s/hexapop" target="_blank" rel="noopener">Code source (AGPL)</a>
    <span>Sans publicité ni traceur.</span>
  </footer>
</main>
{/if}

<style>
  .home { max-width: 1280px; margin: 0 auto; padding: 22px 24px 28px; display: grid; grid-template-columns: minmax(320px, 400px) minmax(0, 1fr); gap: 10px 48px; }
  .left { display: flex; flex-direction: column; gap: 16px; }
  .top { display: flex; align-items: center; gap: 8px; }
  .logo { font-size: 44px; margin: 0 auto 0 0; }
  .chip.gold { background: var(--yellow); box-shadow: 0 3px 0 var(--yellow-d); }
  .focus { align-self: flex-start; border: 0; background: var(--ink); color: #fff; font-weight: 800; font-size: 13px; padding: 5px 11px; border-radius: 999px; margin-top: 6px; cursor: pointer; }
  .goal { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; }
  .goal .seg button { padding: 6px 10px; font-size: 13.5px; }
  .gp { font-weight: 800; font-size: 13.5px; color: var(--soft); }
  .gp.ok { color: var(--green-d); }
  .tip { margin: 0; font-size: 13px; color: var(--soft); font-weight: 700; text-align: right; }
  .hello { display: flex; gap: 12px; align-items: flex-start; }
  .hello .bubble { flex: 1; }
  .next { display: flex; flex-direction: column; gap: 2px; }
  .next small { color: var(--soft); font-weight: 700; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .row2 .btn { flex-direction: column; gap: 3px; padding: 13px 10px; }
  .menu { display: flex; flex-wrap: wrap; gap: 6px 18px; }
  .menu button { background: none; border: 0; padding: 4px 0; cursor: pointer; font-weight: 800; font-size: 15.5px; color: var(--ink); }
  .menu button:hover { color: var(--blue); }
  .menu span { color: var(--soft); font-weight: 700; margin-left: 2px; }
  .right { display: flex; flex-direction: column; gap: 6px; }
  .rhead { display: flex; justify-content: space-between; align-items: flex-start; }
  .pct { font-family: var(--f-pop); font-size: 44px; line-height: 1; }
  .rhead .sub { display: block; margin-top: 4px; font-size: 13px; font-weight: 700; color: var(--soft); }
  .acc { display: flex; gap: 8px; align-items: center; }
  .snd { border: 0; background: #fff; width: 38px; height: 38px; border-radius: 12px; cursor: pointer; box-shadow: 0 3px 0 var(--line); display: grid; place-items: center; }
  .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; font-size: 13px; font-weight: 700; color: var(--soft); justify-content: flex-end; }
  .legend i { display: inline-block; width: 12px; height: 12px; border-radius: 4px; margin-right: 6px; vertical-align: -1px; }
  footer { grid-column: 1 / -1; display: flex; gap: 18px; flex-wrap: wrap; align-items: center; font-size: 13px; color: var(--soft); padding-top: 14px; }
  footer .link { font-weight: 600; color: var(--soft); }
  .acc.mob { display: none; }
  .install { display: flex; gap: 12px; align-items: center; justify-content: space-between; border: 2px dashed var(--line); }
  .install b { font-weight: 900; }
  .install p { font-size: 14px; color: var(--soft); font-weight: 600; }
  .install .how { color: var(--ink); margin-top: 4px; }
  .install .share { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; background: var(--bg); vertical-align: -5px; }
  .install .ia { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: none; }
  @media (max-width: 860px) {
    .acc.mob { display: flex; justify-content: flex-end; margin-top: -8px; }
    .acc.desk { display: none; }
    .home { grid-template-columns: 1fr; padding: 14px 16px 30px; }
    .logo { font-size: 36px; }
  }
  @media (min-width: 861px) { .home { min-height: 100dvh; align-content: center; } }
</style>
