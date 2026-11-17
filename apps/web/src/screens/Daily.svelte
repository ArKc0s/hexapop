<script lang="ts">
  import FullscreenButton from "../lib/ui/FullscreenButton.svelte";
  import { onDestroy } from "svelte";
  import LiveRound from "../lib/LiveRound.svelte";
  import { live } from "../lib/socket.svelte.ts";
  import { api, session, GUEST_DAILY } from "../lib/api.svelte.ts";
  import SaveCard from "../lib/ui/SaveCard.svelte";
  import PushCard from "../lib/ui/PushCard.svelte";
  import { signup } from "../lib/signup.svelte.ts";
  import { nav } from "../lib/nav.svelte.ts";
  import { profile } from "../lib/profile.svelte.ts";
  import { progress } from "../lib/progress.svelte.ts";
  import Mascot from "../lib/ui/Mascot.svelte";
  import type { Rewards } from "@hexa/game";

  interface Board { day: string; number: number; top: { name: string; home: string | null; points: number; elapsedMs: number; grid: string }[]; departements: { code: string; nom: string; players: number; avg: number }[] }
  interface DailyInfo { day: string; number: number; played: boolean; mine: { points: number; elapsedMs: number; grid: string; finished: number } | null; rank: { rank: number; players: number } | null }

  let info = $state<DailyInfo | null>(null);
  // Invité : un seul essai par jour sur cet appareil ; le résultat est gardé pour l'afficher et le rattacher.
  interface GuestDaily { day: string; points: number; elapsedMs: number; grid: number[]; claim?: string }
  let guest = $state<GuestDaily | null>((() => { try { return JSON.parse(localStorage.getItem(GUEST_DAILY) ?? "null"); } catch { return null; } })());
  let board = $state<Board | null>(null);
  let started = $state(false);
  let copied = $state(false);

  api<DailyInfo>("GET", "/daily").then((d) => (info = d)).catch(() => {});
  const loadBoard = () => api<Board>("GET", "/daily/leaderboard").then((b) => (board = b)).catch(() => {});
  loadBoard();

  function start() {
    started = true;
    live.connect(session.me?.pseudo ?? "", () => live.create("daily"));
  }
  $effect(() => { if (live.daily) loadBoard(); });
  $effect(() => {
    const o = live.daily;
    if (!o || session.me || (guest && guest.day === o.day)) return;
    guest = { day: o.day, points: o.points, elapsedMs: o.elapsedMs, grid: o.grid, claim: o.claim };
    offerTimer = setTimeout(() => signup.offer({ kind: "daily" }), 1000);
    try { localStorage.setItem(GUEST_DAILY, JSON.stringify(guest)); } catch { /* rien */ }
  });
  const guestToday = $derived(!session.me && !!guest && guest.day === info?.day ? guest : null);
  // XP, plaques et badges du défi : une seule fois.
  let rewards = $state<Rewards | null>(null);
  $effect(() => {
    if (live.daily && !rewards && live.myResults.length) {
      progress.record(live.myResults);
      rewards = profile.record({ mode: "daily", level: "normal", input: "libre", results: live.myResults, now: Date.now() });
    }
  });
  let offerTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => { clearTimeout(offerTimer); if (live.room?.kind === "daily") live.leave(); });

  const total = $derived(live.room?.players[0]?.score ?? 0);
  const EMOJI = ["🟪", "🟨", "🟦"];
  const outcome = $derived(live.daily);
  const grid = $derived(outcome ? outcome.grid : info?.mine?.grid ? [...info.mine.grid].map(Number) : guestToday ? guestToday.grid : []);
  const shareText = $derived.by(() => {
    const pts = outcome?.points ?? info?.mine?.points ?? guestToday?.points ?? 0;
    const ms = outcome?.elapsedMs ?? info?.mine?.elapsedMs ?? guestToday?.elapsedMs ?? 0;
    const n = outcome?.number ?? info?.number;
    return `HEXA #${n} · défi du jour\n${grid.map((g) => EMOJI[g]).join("")}\n${pts.toLocaleString("fr-FR")} pts · ${Math.round(ms / 1000)} s\n${location.origin}`;
  });

  async function share() {
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ text: shareText });
      else { await navigator.clipboard.writeText(shareText); copied = true; setTimeout(() => (copied = false), 2000); }
    } catch { /* partage annulé */ }
  }
</script>

<main class="daily" class:shell={started && !live.daily && !!live.question} class:page={!(started && !live.daily && !!live.question)}>
  <header>
    <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
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
      <p>10 départements tirés pour tout le monde. Carte, numéro, préfecture : plus tu vas vite, plus tu marques. Un seul essai, nouveau défi à minuit.</p>
      {#if !session.me}<p class="hint">Tu joues en invité : <button class="link" onclick={() => nav.go({ name: "account", view: "register", then: { name: "daily" } })}>crée un compte</button> pour entrer au classement.</p>{/if}
      <button class="btn pink big go" onclick={start}>Jouer le défi</button>
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
        <span class="riso scoreline" data-t={String(outcome?.points ?? info?.mine?.points ?? guestToday?.points ?? 0)}>{outcome?.points ?? info?.mine?.points ?? guestToday?.points ?? 0}</span>
        <div class="grid" aria-label="Résultat case par case">{#each grid as g, i (i)}<i class="g{g}"></i>{/each}</div>
        {#if outcome?.rank || info?.rank}
          {@const r = outcome?.rank ? { rank: outcome.rank, players: outcome.players } : info?.rank}
          <p><b>{r?.rank}{r?.rank === 1 ? "er" : "e"}</b> sur {r?.players} joueur{(r?.players ?? 0) > 1 ? "s" : ""} aujourd'hui</p>
        {:else if !session.me}
          <p>Score pas encore classé.</p>
        {/if}
        {#if rewards}<p class="xp">+{rewards.xp} km</p>{/if}
        <button class="btn pink big" onclick={share}>{copied ? "Copié !" : "Partager"}</button>
      </div>
    </section>
  {/if}

  {#if (outcome || guestToday) && !session.me}<div class="savewrap"><SaveCard daily then={{ name: "daily" }} /></div>{/if}
  {#if outcome || guestToday || info?.played}<div class="savewrap"><PushCard /></div>{/if}

  {#if board && (outcome || info?.played || guestToday)}
    <section class="boards">
      <div>
        <h2 class="label">Classement du jour</h2>
        <ol class="lb">
          {#each board.top.slice(0, 20) as p, i (i)}
            <li class:me={p.name === session.me?.pseudo}><span class="tabnum">{i + 1}</span><span>{p.name}{p.home ? ` · ${p.home}` : ""}</span><b class="tabnum">{p.points}</b></li>
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
  .err { color: #b0005f; font-weight: 600; }
  .end { display: flex; justify-content: center; align-items: center; padding: 20px 0; }
  .card { border: 1.5px solid var(--ink); border-radius: var(--r); background: var(--card); padding: 24px 28px; display: flex; flex-direction: column; align-items: center; gap: 14px; box-shadow: 6px 6px 0 var(--pink); }
  .card p { margin: 0; }
  .scoreline { font-size: 84px; }
  .card { width: min(440px, 100%); padding: 28px !important; }
  .card :global(.btn) { width: 100%; }
  .grid { display: flex; gap: 6px; }
  .grid i { width: 26px; height: 26px; border: 2px solid var(--ink); border-radius: 6px; }
  .g2 { background: var(--blue); } .g1 { background: var(--yellow); } .g0 { background: var(--pink); }
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
</style>
