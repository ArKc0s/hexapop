<script lang="ts">
  import FullscreenButton from "../lib/ui/FullscreenButton.svelte";
  import { onDestroy } from "svelte";
  import { DUEL_HP, REACTIONS, TEAM_LIVES, type Rewards } from "@hexa/game";
  import LiveRound from "../lib/LiveRound.svelte";
  import StageView from "../lib/StageView.svelte";
  import Mascot from "../lib/ui/Mascot.svelte";
  import Icon from "../lib/ui/Icon.svelte";
  import Stars from "../lib/ui/Stars.svelte";
  import { live } from "../lib/socket.svelte.ts";
  import { nav } from "../lib/nav.svelte.ts";
  import { profile } from "../lib/profile.svelte.ts";
  import { progress } from "../lib/progress.svelte.ts";
  import { sound } from "../lib/sound.svelte.ts";
  import SaveCard from "../lib/ui/SaveCard.svelte";

  const room = $derived(live.room);
  const me = $derived(room?.players.find((p) => p.id === live.you));
  const myRank = $derived(room && me ? room.players.indexOf(me) + 1 : 0);
  const s = $derived(live.summary);
  const coop = $derived(room?.kind === "coop");
  // État de l'équipe : dernier connu (fin de tour) ou état de départ.
  let teamNow = $state({ lives: TEAM_LIVES, accuracy: 0, score: 0, lostLife: false });
  $effect(() => { if (s?.team) teamNow = s.team; });
  $effect(() => { if (room?.phase === "countdown") teamNow = { lives: TEAM_LIVES, accuracy: 0, score: 0, lostLife: false }; });
  const FIELD = { carte: "carte", nom: "nom", numero: "numéro", prefecture: "préfecture", sousPrefectures: "sous-préf.", limitrophes: "voisins" } as const;
  const duel = $derived(!!room && room.players.length === 2 && room.players.every((p) => p.hp !== undefined));
  const duo = $derived(duel && room && me ? [me, room.players.find((p) => p.id !== live.you)!].filter(Boolean) : []);

  let now = $state(Date.now());
  const timer = setInterval(() => (now = Date.now()), 250);
  onDestroy(() => clearInterval(timer));
  const nextIn = $derived(s?.nextAt ? Math.max(0, Math.ceil((s.nextAt - (now + live.offset)) / 1000)) : 0);

  $effect(() => { if (!room) nav.go({ name: "lobby" }); else if (room.phase === "lobby") nav.go({ name: "lobby", join: room.code }); });

  // Fin de partie : XP, plaques et badges, une seule fois par partie.
  let rewards = $state<Rewards | null>(null);
  let recorded: unknown = null;
  $effect(() => {
    const ranking = live.ranking;
    if (!ranking || recorded === ranking || !live.myResults.length) return;
    recorded = ranking;
    const won = room?.kind !== "coop" && ranking.length >= 2 && ranking[0].id === live.you;
    progress.record(live.myResults);
    rewards = profile.record({ mode: "multi", level: room?.settings.level ?? "normal", input: room?.settings.input ?? "libre", results: live.myResults, won, now: Date.now() });
    sound.play(won ? "level" : "tap");
  });
  $effect(() => { if (room?.phase === "lobby") rewards = null; });

  const nameOf = (id: string) => room?.players.find((p) => p.id === id)?.name ?? "?";
  function leave() { live.leave(); nav.go({ name: "home" }); }
</script>

<main class="live">
  <header>
    <button class="back" onclick={leave}>← Quitter</button>
    {#if duel}
      <div class="duo">
        {#each duo as p (p.id)}
          <div class="pl" class:me={p.id === live.you}>
            <span class="av">{p.name.slice(0, 1).toUpperCase()}</span>
            <div class="hp"><div class="row"><b>{p.name}</b><span class="tabnum">{p.hp} PV</span></div><div class="bar" class:low={(p.hp ?? 0) < DUEL_HP * 0.35}><i style="width:{((p.hp ?? 0) / DUEL_HP) * 100}%"></i></div></div>
            {#if s?.damage?.[p.id]}<span class="hit">−{s.damage[p.id]}</span>{/if}
          </div>
        {/each}
      </div>
    {:else if coop}
      <span class="hearts" aria-label="{teamNow.lives} vies sur {TEAM_LIVES}">{#each Array(TEAM_LIVES) as _, i (i)}<span class:lost={i >= teamNow.lives}>♥</span>{/each}</span>
      {#if live.question}<span class="chip tabnum">{live.question.index + 1}/{live.question.total}</span>{/if}
      <span class="sp"></span>
      <span class="score tabnum">Équipe · {teamNow.score} pts{teamNow.accuracy ? ` · ${Math.round(teamNow.accuracy * 100)} %` : ""}</span>
    {:else}
      <span class="chip">Salon {room?.code}</span>
      {#if live.question}<span class="chip tabnum">{live.question.index + 1}/{live.question.total}</span>{/if}
      <span class="sp"></span>
      {#if me}<span class="score tabnum">{me.score} pts · {myRank}{myRank === 1 ? "er" : "e"}</span>{/if}
    {/if}
    {#if live.status !== "open"}<span class="chip warn">Reconnexion…</span>{/if}
    <FullscreenButton />
  </header>

  {#if live.ranking && live.teamEnd}
    <section class="end">
      <Stars n={live.teamEnd.stars} size={56} animate />
      <h1 class="riso big" data-t={live.teamEnd.stars ? "BRAVO L'ÉQUIPE" : "PERDU…"}>{live.teamEnd.stars ? "BRAVO L'ÉQUIPE" : "PERDU…"}</h1>
      <p class="xp">{live.teamEnd.score} points d'équipe · {Math.round(live.teamEnd.accuracy * 100)} % de bonnes réponses · {live.teamEnd.lives} vie{live.teamEnd.lives > 1 ? "s" : ""} restante{live.teamEnd.lives > 1 ? "s" : ""}</p>
      <p class="hint">1 étoile à 50 % de moyenne, 2 à 75 %, 3 à 90 %, s'il vous reste au moins une vie.</p>
      <ol class="rank">
        {#each live.ranking as p (p.id)}
          <li class:me={p.id === live.you}><span class="tabnum pos">{p.level === "expert" ? "E" : "N"}</span><span>{p.name}</span><b class="tabnum">{p.score} pts</b></li>
        {/each}
      </ol>
      {#if rewards}<p class="xp">+{rewards.xp} XP{rewards.upgrades.length ? ` · ${rewards.upgrades.length} vignette${rewards.upgrades.length > 1 ? "s" : ""} pour l'album` : ""}</p>{/if}
      <SaveCard />
      <div class="cta">
        {#if me?.host}<button class="btn big" onclick={() => live.send({ t: "rematch" })}>Rejouer ensemble</button>{:else}<span class="hint">L'hôte peut relancer une partie.</span>{/if}
        <button class="btn white big" onclick={leave}>Accueil</button>
      </div>
    </section>
  {:else if live.ranking}
    <section class="end">
      <Mascot mood={myRank === 1 ? "wow" : "happy"} size={72} />
      <h1 class="riso big" data-t={myRank === 1 ? "VICTOIRE !" : `${myRank}e PLACE`}>{myRank === 1 ? "VICTOIRE !" : `${myRank}e PLACE`}</h1>
      <ol class="rank">
        {#each live.ranking as p, i (p.id)}
          <li class:me={p.id === live.you}><span class="tabnum pos">{i + 1}</span><span>{p.name}{p.home ? ` · ${p.home}` : ""}</span><b class="tabnum">{p.hp !== undefined ? `${p.hp} PV` : `${p.score} pts`}</b></li>
        {/each}
      </ol>
      {#if rewards}<p class="xp">+{rewards.xp} XP{rewards.upgrades.length ? ` · ${rewards.upgrades.length} vignette${rewards.upgrades.length > 1 ? "s" : ""} pour l'album` : ""}{rewards.newBadges.length ? " · nouveau badge !" : ""}</p>{/if}
      <SaveCard />
      <div class="cta">
        {#if me?.host}<button class="btn big" onclick={() => live.send({ t: "rematch" })}>Revanche</button>{:else}<span class="hint">L'hôte peut lancer une revanche.</span>{/if}
        <button class="btn white big" onclick={leave}>Accueil</button>
      </div>
    </section>
  {:else if room?.phase === "countdown"}
    <div class="count"><Mascot mood="wow" size={90} /><span class="riso" data-t="PRÊTS ?">PRÊTS ?</span></div>
  {:else if me?.eliminated}
    <p class="out">Éliminé ! Tu regardes la suite en spectateur.</p>
    <StageView />
  {:else}
    <LiveRound>
      {#if s && room}
        {#if coop}
          <p class="teammsg" class:bad={s.team?.lostLife}>{s.team?.lostLife ? "L'équipe perd une vie !" : "L'équipe tient bon."} Moyenne du tour : {Math.round((room.players.reduce((n, p) => n + (s.results[p.id]?.accuracy ?? 0), 0) / Math.max(1, room.players.length)) * 100)} %</p>
          <ul class="mates">
            {#each room.players as p (p.id)}
              {@const r = s.results[p.id]}
              <li class:me={p.id === live.you}><b>{p.name}{p.level === "expert" ? " · expert" : ""}</b>
                {#if r}<span class="flds">{#each r.fields as f (f.field)}<span class:okf={f.score >= 0.999} class:kof={f.score < 0.999}>{FIELD[f.field]}</span>{/each}</span>{:else}<span class="hint">pas de réponse</span>{/if}
              </li>
            {/each}
          </ul>
        {:else if !duel}
          <ol class="mini">
            {#each room.players.slice(0, 8) as p, i (p.id)}
              <li class:me={p.id === live.you} class:gone={p.eliminated}>
                <span class="tabnum">{i + 1}</span><span>{p.name}</span>
                <span class="plus tabnum">{s.results[p.id] ? `+${s.results[p.id].points}` : "–"}</span><b class="tabnum">{p.score}</b>
              </li>
            {/each}
          </ol>
        {/if}
        {#if s.eliminated.includes(live.you ?? "")}<p class="out">Tu es éliminé à cette manche.</p>{/if}
        {#if s.nextAt}<p class="next">Tour suivant dans {nextIn} s</p>{/if}
      {/if}
    </LiveRound>
    {#if live.question && !s}
      <p class="who">{live.answered.size} joueur{live.answered.size > 1 ? "s ont" : " a"} déjà répondu</p>
    {/if}
  {/if}

  {#if room && !live.ranking}
    <div class="reacts" class:asking={!!live.question && !s && room.phase === "question"} role="group" aria-label="Réactions">
      {#each REACTIONS as e (e)}<button onclick={() => live.send({ t: "react", e })} aria-label="Réagir {e}">{e}</button>{/each}
    </div>
  {/if}
  <div class="floats" aria-live="polite">
    {#each live.reactions as r (r.id)}<span class="fl"><b>{r.e}</b><small>{nameOf(r.player)}</small></span>{/each}
  </div>
  <button class="snd" onclick={() => sound.toggle()} aria-label={sound.on ? "Couper le son" : "Activer le son"}><Icon name={sound.on ? "sound" : "mute"} /></button>
</main>

<style>
  .live { max-width: 1320px; margin: 0 auto; padding: 12px 16px 90px; display: flex; flex-direction: column; gap: 12px; position: relative; }
  header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding-right: 48px; }
  .sp { flex: 1; }
  .score { font-weight: 900; font-size: 18px; }
  .warn { background: var(--pink); color: #fff; }
  .duo { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .pl { display: flex; align-items: center; gap: 10px; background: #fff; border-radius: 18px; padding: 8px 12px; position: relative; }
  .pl.me { outline: 3px solid var(--yellow); outline-offset: -3px; }
  .av { width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center; background: var(--blue); color: #fff; font-family: var(--f-pop); flex: none; }
  .pl:not(.me) .av { background: var(--pink); }
  .hp { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .hp .row { display: flex; justify-content: space-between; font-weight: 800; font-size: 14px; }
  .hp .bar { height: 14px; }
  .hp .bar.low i { background: var(--pink); }
  .hit { position: absolute; right: 14px; top: -12px; font-family: var(--f-pop); color: var(--pink); font-size: 24px; animation: float-up 1.4s ease-out forwards; }
  .count { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 60px 0; }
  .count .riso { font-size: clamp(56px, 10vw, 110px); }
  .mini { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
  .mini li { display: grid; grid-template-columns: 24px 1fr auto 64px; gap: 8px; padding: 5px 8px; border-radius: 10px; font-weight: 700; }
  .mini li.me { background: #fff4c2; }
  .mini li.gone { opacity: .45; }
  .mini b { text-align: right; }
  .plus { color: var(--blue); font-weight: 800; }
  .next, .who { font-weight: 700; color: var(--soft); }
  .out { font-weight: 800; color: var(--pink-d); }
  .end { max-width: 560px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; padding-top: 20px; }
  .end .big { font-size: clamp(48px, 9vw, 80px); }
  .rank { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; width: 100%; }
  .rank li { display: grid; grid-template-columns: 34px 1fr auto; gap: 10px; align-items: center; padding: 10px 14px; border-radius: 16px; background: #fff; font-weight: 800; box-shadow: 0 3px 0 var(--line); }
  .rank li.me { background: #fff4c2; }
  .pos { font-family: var(--f-pop); }
  .xp { font-weight: 800; color: var(--green-d); }
  .cta { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: center; }
  .hint { color: var(--soft); font-weight: 700; }
  .reacts { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); display: flex; gap: 6px; background: #fff; padding: 6px; border-radius: 18px; box-shadow: 0 6px 20px -8px rgba(28, 26, 55, .35); z-index: 10; }
  .reacts button { border: 0; background: var(--bg); width: 42px; height: 42px; border-radius: 12px; font-size: 21px; cursor: pointer; }
  .reacts button:active { transform: scale(.9); }
  .floats { position: fixed; right: 18px; bottom: 80px; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; pointer-events: none; z-index: 11; }
  .fl { display: flex; align-items: center; gap: 6px; background: #fff; border-radius: 999px; padding: 4px 12px 4px 6px; box-shadow: 0 4px 12px -6px rgba(0, 0, 0, .3); animation: pop-in .3s cubic-bezier(.2, 1.6, .4, 1); }
  .fl b { font-size: 24px; }
  .fl small { font-weight: 800; }
  .snd { position: fixed; right: 14px; top: 12px; border: 0; background: #fff; width: 38px; height: 38px; border-radius: 12px; cursor: pointer; box-shadow: 0 3px 0 var(--line); display: grid; place-items: center; z-index: 5; }
  @media (max-width: 700px) {
    .av { display: none; }
    /* Sur mobile : réactions dans le flux (pas par-dessus « Valider »), masquées pendant qu'on répond */
    .reacts { position: static; transform: none; align-self: center; box-shadow: none; }
    .reacts.asking { display: none; }
    .reacts button { width: 38px; height: 38px; }
    .snd { display: none; }
    .live { padding-bottom: 24px; }
  }
  @media (min-width: 901px) { .live { min-height: 100dvh; } .live > :global(.round) { flex: 1; align-content: center; } }
  .hearts { display: inline-flex; gap: 3px; font-size: 24px; color: var(--pink); }
  .hearts .lost { color: #e2dacb; }
  .teammsg { font-weight: 800; color: var(--green-d); }
  .teammsg.bad { color: var(--pink-d); animation: shake .35s; }
  .mates { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .mates li { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border-radius: 12px; background: var(--bg); }
  .mates li.me { background: #fff4c2; }
  .flds { display: flex; flex-wrap: wrap; gap: 4px; }
  .flds span { font-size: 12px; font-weight: 800; padding: 2px 8px; border-radius: 999px; color: #fff; }
  .okf { background: var(--blue); } .kof { background: var(--pink); }
</style>
