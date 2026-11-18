<script lang="ts">
  import FullscreenButton from "../lib/ui/FullscreenButton.svelte";
  import GameSheet from "../lib/ui/GameSheet.svelte";
  import { dailyCardBlob } from "../lib/shareCard.ts";
  import { onDestroy } from "svelte";
  import LiveRound from "../lib/LiveRound.svelte";
  import { live } from "../lib/socket.svelte.ts";
  import { api, session, GUEST_DAILY } from "../lib/api.svelte.ts";
  import SaveCard from "../lib/ui/SaveCard.svelte";
  import PushCard from "../lib/ui/PushCard.svelte";
  import { signup } from "../lib/signup.svelte.ts";
  import { guestId } from "../lib/guest.ts";
  import { nav } from "../lib/nav.svelte.ts";
  import { profile } from "../lib/profile.svelte.ts";
  import { progress } from "../lib/progress.svelte.ts";
  import Mascot from "../lib/ui/Mascot.svelte";
  import { LEVELS, LEVEL_NAMES, LEVEL_OF, PLAYER_LEVELS, levelAllowed, playerLevel, type Level, type Rewards } from "@hexa/game";

  interface Board { day: string; number: number; level: Level; counts: Partial<Record<Level, number>>; top: { name: string; home: string | null; points: number; elapsedMs: number; grid: string; guest?: number }[]; departements: { code: string; nom: string; players: number; avg: number }[] }
  interface DailyInfo { day: string; number: number; played: boolean; mine: { level: Level; points: number; elapsedMs: number; grid: string; finished: number; share?: string | null } | null; rank: { rank: number; players: number } | null }

  let info = $state<DailyInfo | null>(null);
  // Invité : un seul essai par jour sur cet appareil ; le résultat est gardé pour l'afficher et le rattacher.
  interface GuestDaily { day: string; level?: Level; points: number; elapsedMs: number; grid: number[]; claim?: string; name?: string; rank?: number; players?: number; share?: string }
  let guest = $state<GuestDaily | null>((() => { try { return JSON.parse(localStorage.getItem(GUEST_DAILY) ?? "null"); } catch { return null; } })());
  let board = $state<Board | null>(null);
  let started = $state(false);
  let copied = $state(false);

  // Niveau : le sien par défaut (d'après « Ta France »), ou en dessous, jamais au-dessus.
  const maxLevel = LEVEL_OF[playerLevel(profile.data.know ?? {})];
  let level = $state<Level>(maxLevel);
  const LEVEL_DESC: Record<Level, string> = {
    decouverte: "On te donne le nom ou la carte, avec 4 propositions faciles.",
    normal: "Tous les indices, réponses au clavier.",
    expert: "Au clavier, avec en plus les sous-préfectures et les voisins.",
  };
  const unlockAt: Record<Level, number> = { decouverte: 0, normal: PLAYER_LEVELS.confirme.min, expert: PLAYER_LEVELS.expert.min };

  /** Onglet du classement affiché : par défaut, le niveau auquel on a joué. */
  let boardLevel = $state<Level>(maxLevel);
  api<DailyInfo>("GET", "/daily").then((d) => { info = d; if (d.mine?.level) boardLevel = d.mine.level; }).catch(() => {});
  const loadBoard = (l: Level = boardLevel) => api<Board>("GET", `/daily/leaderboard?level=${l}`).then((b) => (board = b)).catch(() => {});
  $effect(() => { loadBoard(boardLevel); });

  function start() {
    started = true;
    if (!session.me) guestId(true); // classé sous un pseudo généré, gardé par ce navigateur
    boardLevel = level;
    live.connect(session.me?.pseudo ?? "", () => live.create("daily", { level }));
  }
  $effect(() => { if (live.daily) { boardLevel = live.daily.level ?? level; loadBoard(boardLevel); } });
  $effect(() => {
    const o = live.daily;
    if (!o || session.me || (guest && guest.day === o.day)) return;
    guest = { day: o.day, level: o.level, points: o.points, elapsedMs: o.elapsedMs, grid: o.grid, claim: o.claim, name: o.name, rank: o.rank, players: o.players, share: o.share };
    offerTimer = setTimeout(() => signup.offer({ kind: "daily", guestName: o.name, games: profile.data.stats.games }), 1000);
    try { localStorage.setItem(GUEST_DAILY, JSON.stringify(guest)); } catch { /* rien */ }
  });
  /** Pseudo généré de l'invité au classement (« Mouette du Finistère »). */
  const myGuestName = $derived(live.daily?.name ?? guest?.name ?? null);
  const guestToday = $derived(!session.me && !!guest && guest.day === info?.day ? guest : null);
  $effect(() => { if (guestToday?.level) boardLevel = guestToday.level; });
  /** Niveau auquel on a joué aujourd'hui. */
  const playedLevel = $derived<Level>(live.daily?.level ?? info?.mine?.level ?? guestToday?.level ?? level);
  // XP, plaques et badges du défi : une seule fois.
  let rewards = $state<Rewards | null>(null);
  $effect(() => {
    if (live.daily && !rewards && live.myResults.length) {
      progress.record(live.myResults);
      rewards = profile.record({ mode: "daily", level: playedLevel, input: playedLevel === "decouverte" ? "choix" : "libre", results: live.myResults, now: Date.now() });
    }
  });
  let offerTimer: ReturnType<typeof setTimeout> | undefined;
  /** Quitter en plein défi : l'essai du jour est déjà compté, on prévient. */
  let asking = $state(false);
  onDestroy(() => { clearTimeout(offerTimer); if (live.room?.kind === "daily") live.leave(); });

  const total = $derived(live.room?.players[0]?.score ?? 0);
  // ✅ juste, 🟧 à moitié, ❌ raté : lisible par quelqu'un qui n'a jamais joué (avec le décompte en toutes lettres).
  const EMOJI = ["❌", "🟧", "✅"];
  const outcome = $derived(live.daily);
  const grid = $derived(outcome ? outcome.grid : info?.mine?.grid ? [...info.mine.grid].map(Number) : guestToday ? guestToday.grid : []);
  const shareText = $derived.by(() => {
    const pts = outcome?.points ?? info?.mine?.points ?? guestToday?.points ?? 0;
    const ms = outcome?.elapsedMs ?? info?.mine?.elapsedMs ?? guestToday?.elapsedMs ?? 0;
    const n = outcome?.number ?? info?.number;
    const ok = grid.filter((g) => g === 2).length, mid = grid.filter((g) => g === 1).length, ko = grid.filter((g) => g === 0).length;
    const r = outcome?.rank ? { rank: outcome.rank, players: outcome.players } : info?.rank ?? (guestToday?.rank ? { rank: guestToday.rank, players: guestToday.players } : null);
    const share = outcome?.share ?? info?.mine?.share ?? guestToday?.share;
    return [
      `HEXA #${n} · défi du jour · ${LEVEL_NAMES[playedLevel]}`,
      grid.map((g) => EMOJI[g]).join(""),
      [`${ok} juste${ok > 1 ? "s" : ""}`, mid ? `${mid} à moitié` : "", ko ? `${ko} raté${ko > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · "),
      `${pts.toLocaleString("fr-FR")} pts en ${Math.round(ms / 1000)} s${r?.rank ? ` · ${r.rank}${r.rank === 1 ? "er" : "e"} sur ${r.players}` : ""}`,
      share ? `Mes réponses : ${location.origin}/d/${share}` : `À toi : ${location.origin}`,
    ].join("\n");
  });

  const coarse = typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches;
  /** L'image du résultat (voir shareCard.ts). */
  async function cardFile(): Promise<File | null> {
    const pts = outcome?.points ?? info?.mine?.points ?? guestToday?.points ?? 0;
    const ms = outcome?.elapsedMs ?? info?.mine?.elapsedMs ?? guestToday?.elapsedMs ?? 0;
    const n = outcome?.number ?? info?.number ?? 0;
    const rank = outcome?.rank ? { rank: outcome.rank, players: outcome.players ?? outcome.rank } : info?.rank ?? (guestToday?.rank ? { rank: guestToday.rank, players: guestToday.players ?? guestToday.rank } : null);
    const blob = await dailyCardBlob({ number: n, level: LEVEL_NAMES[playedLevel], points: pts, seconds: Math.round(ms / 1000), grid, rank });
    return blob ? new File([blob], `hexa-defi-${n}.png`, { type: "image/png" }) : null;
  }
  async function share() {
    try {
      if (navigator.share && coarse) {
        // Téléphone : le texte et le lien, comme une appli. L'image du score arrive par l'aperçu du lien (la page partagée
        // a la sienne) : envoyer l'image avec le texte laissait Snapchat sur un écran noir (testé sur iPhone : seuls
        // « texte + lien » ou « image seule » passent partout, et l'image seule perd le lien).
        await navigator.share({ text: shareText });
      } else { await navigator.clipboard.writeText(shareText); copied = true; setTimeout(() => (copied = false), 2000); }
    } catch { /* partage annulé */ }
  }
  /** Ordinateur : télécharger l'image à poster. */
  async function download() {
    const f = await cardFile();
    if (!f) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
</script>

<main class="daily" class:shell={started && !live.daily && !!live.question} class:page={!(started && !live.daily && !!live.question)}>
  <header>
    <button class="back" onclick={() => (started && !outcome && live.question ? (asking = true) : nav.go({ name: "home" }))}>← Accueil</button>
    <span class="grow"></span>
    {#if info}<span class="chip">Défi n° {info.number}</span>{/if}
    <FullscreenButton />
    {#if started && !outcome}<span class="score tabnum">{total} pts</span>{/if}
  </header>

  {#if live.error && started}
    <p class="err" role="alert">{live.error.message}</p>
  {/if}

  {#if !started && !(info?.played) && !guestToday}
    <section class="intro">
      <Mascot mood="happy" size={70} />
      <h1 class="title">Défi du jour</h1>
      <p>Les mêmes 10 départements pour tout le monde, des questions à ton niveau, et un classement par niveau. Plus tu vas vite, plus tu marques. Un seul essai, nouveau défi à minuit.</p>
      <div class="levels" role="radiogroup" aria-label="Niveau du défi">
        {#each LEVELS as l (l)}
          {@const ok = levelAllowed(l, maxLevel)}
          <button class="lvl" class:on={level === l} disabled={!ok} role="radio" aria-checked={level === l} onclick={() => (level = l)}>
            <b>{LEVEL_NAMES[l]}{l === maxLevel ? " · ton niveau" : ""}</b>
            <small>{ok ? LEVEL_DESC[l] : `S'ouvre à ${unlockAt[l]} % de « Ta France ».`}</small>
          </button>
        {/each}
      </div>
      {#if !session.me}<p class="hint">Tu joues en invité : tu seras classé sous un pseudo tiré au sort. <button class="link" onclick={() => nav.go({ name: "account", view: "register", then: { name: "daily" } })}>Crée un compte</button> pour jouer sous ton pseudo et entrer au Hall of Fame.</p>{/if}
      <button class="btn pink big go" onclick={start}>Jouer le défi · {LEVEL_NAMES[level]}</button>
    </section>
  {:else if started && !outcome && live.question}
    <LiveRound>
      {#snippet action()}<button class="btn blue big" onclick={() => live.send({ t: "next" })}>{live.question!.index + 1 >= live.question!.total ? "Voir le bilan" : "Suivant"} <kbd>↵</kbd></button>{/snippet}
    </LiveRound>
  {:else if started && !outcome}
    <p class="wait">Préparation du défi…</p>
  {/if}

  {#if outcome || (!started && (info?.played || guestToday))}
    <section class="end">
      <div class="card">
        <span class="chip lvchip">Défi n° {outcome?.number ?? info?.number} · {LEVEL_NAMES[playedLevel]}</span>
        <span class="riso scoreline" data-t={String(outcome?.points ?? info?.mine?.points ?? guestToday?.points ?? 0)}>{outcome?.points ?? info?.mine?.points ?? guestToday?.points ?? 0}</span>
        <div class="grid" aria-label="Résultat case par case">{#each grid as g, i (i)}<i class="g{g}"></i>{/each}</div>
        {#if outcome?.rank || info?.rank || guestToday?.rank}
          {@const r = outcome?.rank ? { rank: outcome.rank, players: outcome.players } : info?.rank ?? { rank: guestToday?.rank, players: guestToday?.players }}
          <p><b>{r?.rank}{r?.rank === 1 ? "er" : "e"}</b> sur {r?.players} joueur{(r?.players ?? 0) > 1 ? "s" : ""} en {LEVEL_NAMES[playedLevel]} aujourd'hui</p>
          {#if !session.me && myGuestName}<p class="hint">Tu es classé comme <b>{myGuestName}</b>. Crée un compte pour garder ce score sous ton pseudo.</p>{/if}
        {:else if !session.me}
          <p>Score pas encore classé.</p>
        {/if}
        {#if rewards}<p class="xp">+{rewards.xp} km</p>{/if}
        <button class="btn pink big" onclick={share}>{copied ? "Copié !" : coarse ? "Partager" : "Copier le résultat"}</button>
        {#if !coarse}<button class="link" onclick={download}>Télécharger l'image à poster</button>{/if}
        {#if outcome?.share ?? info?.mine?.share ?? guestToday?.share}<a class="link" href="/d/{outcome?.share ?? info?.mine?.share ?? guestToday?.share}" target="_blank" rel="noopener">Voir ma page de résultat (ce que voient tes amis)</a>{/if}
      </div>
    </section>
  {/if}

  {#if (outcome || guestToday) && !session.me}<div class="savewrap"><SaveCard daily then={{ name: "daily" }} /></div>{/if}
  {#if outcome || guestToday || info?.played}<div class="savewrap"><PushCard /></div>{/if}

  {#if board && (outcome || info?.played || guestToday)}
    <section class="boards">
      <div>
        <h2 class="label">Classement du jour · <button class="link" onclick={() => nav.go({ name: "hof" })}>Hall of Fame</button></h2>
        <div class="seg lvtabs" role="tablist" aria-label="Classement par niveau">
          {#each LEVELS as l (l)}<button role="tab" aria-selected={boardLevel === l} class:on={boardLevel === l} onclick={() => (boardLevel = l)}>{LEVEL_NAMES[l]}{board.counts?.[l] ? ` · ${board.counts[l]}` : ""}</button>{/each}
        </div>
        <ol class="lb">
          {#each board.top.slice(0, 20) as p, i (i)}
            <li class:me={p.name === (session.me?.pseudo ?? myGuestName)}><span class="tabnum">{i + 1}</span><span>{p.name}{p.home && !p.guest ? ` · ${p.home}` : ""}{#if p.guest}<small class="inv">invité</small>{/if}</span><b class="tabnum">{p.points}</b></li>
          {:else}<li class="empty">Personne encore, tu ouvres le bal.</li>{/each}
        </ol>
      </div>
      <div>
        <h2 class="label">Départements les plus forts</h2>
        <ol class="lb">
          {#each board.departements as d, i (d.code)}
            <li><span class="tabnum">{i + 1}</span><span>{d.nom} ({d.players})</span><b class="tabnum">{d.avg}</b></li>
          {:else}<li class="empty">Il faut 3 joueurs d'un même département pour qu'il apparaisse.</li>{/each}
        </ol>
      </div>
    </section>
  {/if}
</main>

{#if asking && started && !outcome}
  <GameSheet title="Abandonner le défi ?" mood="think" seeThrough primary="Continuer le défi" onprimary={() => (asking = false)} secondary="Abandonner" onsecondary={() => { asking = false; nav.go({ name: "home" }); }}>
    <p>Un seul essai par jour : il compte dès le départ. Si tu quittes, tu ne seras pas classé aujourd'hui et tu ne pourras pas le rejouer.</p>
  </GameSheet>
{/if}

<style>
  .daily { --w: 640px; display: flex; flex-direction: column; gap: 18px; }
  /* En partie : le cadre de jeu (pleine largeur) ; hors partie : le cadre commun des pages (.page). */
  /* Fin du défi : les deux classements côte à côte demandent plus de largeur */
  .daily.page:has(.boards) { --w: 900px; }
  .daily:not(.page) { max-width: 1320px; margin: 0 auto; padding: 12px 16px 24px; }
  header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  
  .grow { margin-right: auto; }
  header > .chip { height: 38px; padding: 0 14px; box-shadow: 0 3px 0 var(--line); }
  .score { font-family: var(--f-ui); font-weight: 600; font-size: 18px; }
  .intro { max-width: 640px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; padding: 30px 0; }
  .intro h1 { font-size: clamp(40px, 7vw, 64px); text-transform: uppercase; }
  .intro p { margin: 0; font-size: 17px; }
  .hint { font-size: 14px !important; }
  
  .go { align-self: flex-start; font-size: 22px; }
  .wait { font-weight: 600; }
  .levels { display: flex; flex-direction: column; gap: 8px; }
  .lvl { border: 0; font: inherit; color: inherit; text-align: left; background: #fff; border-radius: 16px; padding: 12px 16px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 3px 0 var(--line); }
  .lvl b { font-weight: 900; font-size: 16.5px; }
  .lvl small { font-size: 14px; font-weight: 600; color: var(--soft); }
  .lvl.on { background: var(--ink); color: #fff; box-shadow: 0 3px 0 #000; }
  .lvl.on small { color: #d9d6ea; }
  .lvl:disabled { background: transparent; box-shadow: none; border: 2px dashed var(--line); cursor: default; opacity: .8; }
  .lvchip { align-self: center; height: 32px; }
  .lvtabs { margin-bottom: 10px; }
  .lvtabs button { padding: 6px 10px; font-size: 13px; }
  .err { color: #b0005f; font-weight: 600; }
  .end { display: flex; justify-content: center; align-items: center; padding: 20px 0; }
  .card { border: 1.5px solid var(--ink); border-radius: var(--r); background: var(--card); padding: 24px 28px; display: flex; flex-direction: column; align-items: center; gap: 14px; box-shadow: 6px 6px 0 var(--pink); }
  .card p { margin: 0; }
  .scoreline { font-size: 84px; }
  .card { width: min(440px, 100%); padding: 28px !important; }
  .card :global(.btn) { width: 100%; }
  .grid { display: flex; gap: 6px; }
  .grid i { width: 26px; height: 26px; border: 2px solid var(--ink); border-radius: 6px; }
  .g2 { background: var(--ok); } .g1 { background: var(--yellow); } .g0 { background: var(--ko); }
  .boards { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; max-width: 900px; width: 100%; margin: 0 auto; }
  h2 { margin: 0 0 8px; }
  .lb { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .lb li { display: grid; grid-template-columns: 28px 1fr auto; gap: 8px; padding: 4px 8px; border-radius: 8px; }
  .lb li.me { background: var(--yellow); }
  .lb li.empty { display: block; color: var(--soft); font-weight: 600; }
  @media (max-width: 700px) { .boards { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { header { gap: 8px; flex-wrap: nowrap; } header .chip:not(.warn) { display: none; } }
  @media (min-width: 901px) { .daily:not(.page) { min-height: 100dvh; padding-top: max(24px, calc((100dvh - 840px) / 2)); } }
  .xp { font-weight: 800; color: var(--green-d); }
  .card { box-shadow: 0 6px 0 var(--line) !important; border: 0 !important; background: #fff !important; border-radius: 28px !important; }
  .lb li.me { background: #fff4c2 !important; }
  .savewrap { display: flex; justify-content: center; }
  .inv { margin-left: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--soft); background: var(--bg); border-radius: 999px; padding: 1px 7px; }
</style>
