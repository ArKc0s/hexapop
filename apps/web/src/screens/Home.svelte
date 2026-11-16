<script lang="ts">
  import { onDestroy } from "svelte";
  import { DEPARTEMENTS, MAX_TIER_POINTS, dayKey, isFading, levelInfo, liveStreak, mastery, nextTourRegion, platesOwned, questsFor, totalStars } from "@hexa/game";
  import Map from "../lib/Map.svelte";
  import Mascot from "../lib/ui/Mascot.svelte";
  import Icon from "../lib/ui/Icon.svelte";
  import { nav } from "../lib/nav.svelte.ts";
  import { progress } from "../lib/progress.svelte.ts";
  import { profile } from "../lib/profile.svelte.ts";
  import { session } from "../lib/api.svelte.ts";
  import { sound } from "../lib/sound.svelte.ts";
  import { rankFor } from "../lib/rank.ts";

  const all = DEPARTEMENTS.map((d) => d.code);
  const p = $derived(profile.data);
  const lvl = $derived(levelInfo(p.xp));
  const rank = $derived(rankFor(mastery(progress.data, all)).name);
  const streak = $derived(liveStreak(p, Date.now()));
  const playedToday = $derived(p.streak.last === dayKey(Date.now()));
  const quests = $derived(questsFor(dayKey(Date.now())).map((q) => ({ ...q, done: Math.min(q.target, p.quests.day === dayKey(Date.now()) ? (p.quests.progress[q.id] ?? 0) : 0) })));
  const questsLeft = $derived(quests.filter((q) => q.done < q.target).length);
  const next = $derived(nextTourRegion(p));
  // Maîtrise réelle : bronze 1, argent 2, or 3 points ; un département à réviser ne compte qu'à moitié.
  const fading = $derived(all.filter((c) => (p.tiers[c] ?? 0) > 0 && isFading(progress.data, c, Date.now())));
  const pct = $derived(Math.floor((all.reduce((n, c) => n + (p.tiers[c] ?? 0) * (fading.includes(c) ? 0.5 : 1), 0) / MAX_TIER_POINTS) * 100));
  const TIER_FILL = ["", "#e6b98e", "#b4bfcd", "#f5c518"];
  const fills = $derived(Object.fromEntries(all.filter((c) => p.tiers[c]).map((c) => [c, fading.includes(c) ? "var(--tint-ko)" : TIER_FILL[p.tiers[c]]])));

  const hello = $derived.by(() => {
    if (!p.stats.games) return "Salut ! Moi c'est Hexa. On fait le tour de France ensemble ?";
    if (fading.length >= 5) return `${fading.length} départements commencent à s'effacer de ta carte. Une petite révision ?`;
    if (streak > 0 && !playedToday) return `Une partie aujourd'hui pour garder ta série de ${streak} jour${streak > 1 ? "s" : ""} !`;
    if (questsLeft) return `Encore ${questsLeft} quête${questsLeft > 1 ? "s" : ""} du jour à boucler.`;
    if (next) return `Prochaine étape : ${next.nom}.`;
    return "Toutes les quêtes du jour sont faites. Respect.";
  });

  function play() {
    sound.play("tap");
    if (!p.tourStart || !next) nav.go({ name: "tour" });
    else nav.go({ name: "tour", region: next.code });
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

<main class="home">
  <section class="left">
    <div class="top">
      <h1 class="riso logo" data-t="HEXA">HEXA</h1>
      <span class="chip" title="Série de jours joués"><Icon name="flame" /> {streak}</span>
      <span class="lvl" title="Niveau {lvl.level}"><span class="ring" style="--p:{lvl.ratio * 100}"><span>{lvl.level}</span></span><span class="rk">{rank}</span></span>
    </div>

    <div class="hello"><Mascot mood="happy" size={66} /><p class="bubble">{hello}</p></div>

    <div class="next">
      <button class="btn big wide" onclick={play}>Jouer <Icon name="play" size={20} /></button>
      <small>{!p.tourStart ? "Tour de France · choisis ta région de départ" : next ? `Tour de France · ${next.nom} · ${p.stars[next.code] ?? 0}/3 étoiles` : "Tour de France terminé ! Place à l'entraînement."}</small>
    </div>

    <div class="row2">
      <button class="btn pink" disabled={!session.online} onclick={() => nav.go({ name: "daily" })}>Défi du jour<small>nouveau dans {countdown}</small></button>
      <button class="btn blue" disabled={!session.online} onclick={() => nav.go({ name: "lobby" })}>Entre amis<small>duel ou soirée</small></button>
    </div>

    <div class="card quests">
      <span class="k">Quêtes du jour · +50 XP chacune</span>
      {#each quests as q (q.id)}
        <div class="q" class:done={q.done >= q.target}>
          <span>{q.label}</span><em class="tabnum">{q.done >= q.target ? "✓" : `${q.done}/${q.target}`}</em>
          <div class="bar"><i style="width:{(q.done / q.target) * 100}%"></i></div>
        </div>
      {/each}
    </div>

    <nav class="menu" aria-label="Autres modes">
      <button onclick={() => nav.go({ name: "tour" })}>Tour de France <span>{totalStars(p)} ★</span></button>
      <button onclick={() => nav.go({ name: "training" })}>Entraînement</button>
      <button onclick={() => nav.go({ name: "album" })}>Album <span>{platesOwned(p)}/101</span></button>
      <button onclick={() => nav.go({ name: "atlas" })}>Atlas</button>
    </nav>
  </section>

  <section class="right" aria-label="Ta France">
    <div class="rhead">
      <div><span class="k">Ta France</span><div class="pct tabnum">{pct} %</div></div>
      <div class="acc">
        {#if session.me}
          <button class="back" onclick={() => nav.go({ name: "account", view: "profile" })}>{session.me.pseudo}</button>
        {:else if session.online}
          <button class="back" onclick={() => nav.go({ name: "account", view: "login" })}>Se connecter</button>
        {/if}
        <button class="snd" onclick={() => sound.toggle()} aria-label={sound.on ? "Couper le son" : "Activer le son"}><Icon name={sound.on ? "sound" : "mute"} /></button>
      </div>
    </div>
    <Map {fills} interactive={false} label="Ta France : maîtrise de chaque département" />
    <div class="legend">
      <span><i style="background:#e6b98e"></i>bronze</span><span><i style="background:#b4bfcd"></i>argent</span><span><i style="background:#f5c518"></i>or</span>
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

<style>
  .home { max-width: 1280px; margin: 0 auto; padding: 22px 24px 28px; display: grid; grid-template-columns: minmax(320px, 400px) minmax(0, 1fr); gap: 10px 48px; }
  .left { display: flex; flex-direction: column; gap: 16px; }
  .top { display: flex; align-items: center; gap: 8px; }
  .logo { font-size: 44px; margin: 0 auto 0 0; }
  .lvl { display: inline-flex; align-items: center; gap: 8px; background: #fff; border-radius: 999px; padding: 4px 12px 4px 4px; font-weight: 800; font-size: 14px; }
  .ring { width: 30px; height: 30px; border-radius: 50%; background: conic-gradient(var(--green) calc(var(--p) * 1%), #e9e2d3 0); display: grid; place-items: center; }
  .ring span { width: 22px; height: 22px; border-radius: 50%; background: #fff; display: grid; place-items: center; font-size: 12px; }
  .hello { display: flex; gap: 12px; align-items: flex-start; }
  .hello .bubble { flex: 1; }
  .next { display: flex; flex-direction: column; gap: 2px; }
  .next small { color: var(--soft); font-weight: 700; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .row2 .btn { flex-direction: column; gap: 3px; padding: 13px 10px; }
  .quests { display: flex; flex-direction: column; gap: 10px; }
  .q { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; align-items: center; font-weight: 700; font-size: 14.5px; }
  .q .bar { grid-column: 1 / -1; height: 9px; }
  .q em { font-style: normal; color: var(--soft); font-size: 13px; font-weight: 800; }
  .q.done { color: var(--green-d); }
  .menu { display: flex; flex-wrap: wrap; gap: 6px 18px; }
  .menu button { background: none; border: 0; padding: 4px 0; cursor: pointer; font-weight: 800; font-size: 15.5px; color: var(--ink); }
  .menu button:hover { color: var(--blue); }
  .menu span { color: var(--soft); font-weight: 700; margin-left: 2px; }
  .right { display: flex; flex-direction: column; gap: 6px; }
  .rhead { display: flex; justify-content: space-between; align-items: flex-start; }
  .pct { font-family: var(--f-pop); font-size: 44px; line-height: 1; }
  .acc { display: flex; gap: 8px; align-items: center; }
  .snd { border: 0; background: #fff; width: 38px; height: 38px; border-radius: 12px; cursor: pointer; box-shadow: 0 3px 0 var(--line); display: grid; place-items: center; }
  .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; font-size: 13px; font-weight: 700; color: var(--soft); justify-content: flex-end; }
  .legend i { display: inline-block; width: 12px; height: 12px; border-radius: 4px; margin-right: 6px; vertical-align: -1px; }
  footer { grid-column: 1 / -1; display: flex; gap: 18px; flex-wrap: wrap; align-items: center; font-size: 13px; color: var(--soft); padding-top: 14px; }
  footer .link { font-weight: 600; color: var(--soft); }
  @media (max-width: 860px) {
    .home { grid-template-columns: 1fr; padding: 14px 16px 30px; }
    .logo { font-size: 36px; }
    .rk { display: none; }
    .lvl { padding-right: 4px; }
  }
  @media (min-width: 861px) { .home { min-height: 100dvh; align-content: center; } }
</style>
