<script lang="ts">
  import { onDestroy } from "svelte";
  import LiveRound from "../lib/LiveRound.svelte";
  import { live } from "../lib/socket.svelte.ts";
  import { api, session } from "../lib/api.svelte.ts";
  import { nav } from "../lib/nav.svelte.ts";

  interface Board { day: string; number: number; top: { name: string; home: string | null; points: number; elapsedMs: number; grid: string }[]; departements: { code: string; nom: string; players: number; avg: number }[] }
  interface DailyInfo { day: string; number: number; played: boolean; mine: { points: number; elapsedMs: number; grid: string; finished: number } | null; rank: { rank: number; players: number } | null }

  let info = $state<DailyInfo | null>(null);
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
  onDestroy(() => { if (live.room?.kind === "daily") live.leave(); });

  const total = $derived(live.room?.players[0]?.score ?? 0);
  const EMOJI = ["🟪", "🟨", "🟦"];
  const outcome = $derived(live.daily);
  const grid = $derived(outcome ? outcome.grid : info?.mine?.grid ? [...info.mine.grid].map(Number) : []);
  const shareText = $derived.by(() => {
    const pts = outcome?.points ?? info?.mine?.points ?? 0;
    const ms = outcome?.elapsedMs ?? info?.mine?.elapsedMs ?? 0;
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

<main class="daily">
  <header>
    <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
    <span class="riso logo" data-t="HEXA">HEXA</span>
    {#if info}<span class="chip">Défi n° {info.number}</span>{/if}
    {#if started && !outcome}<span class="score tabnum">{total} pts</span>{/if}
  </header>

  {#if live.error && started}
    <p class="err" role="alert">{live.error.message}</p>
  {/if}

  {#if !started && !(info?.played)}
    <section class="intro">
      <h1 class="riso" data-t="DÉFI DU JOUR">DÉFI DU JOUR</h1>
      <p>10 départements tirés pour tout le monde. Carte, numéro, préfecture : plus tu vas vite, plus tu marques. Un seul essai, nouveau défi à minuit.</p>
      {#if !session.me}<p class="hint">Tu joues en invité : <button class="inline" onclick={() => nav.go({ name: "account", view: "register", then: { name: "daily" } })}>crée un compte</button> pour entrer au classement.</p>{/if}
      <button class="btn go" onclick={start}>Jouer le défi</button>
    </section>
  {:else if started && !outcome && live.question}
    <LiveRound>
      <button class="btn blue" onclick={() => live.send({ t: "next" })}>{live.question.index + 1 >= live.question.total ? "Voir le bilan" : "Suivant"} ↵</button>
    </LiveRound>
  {:else if started && !outcome}
    <p class="wait">Préparation du défi…</p>
  {/if}

  {#if outcome || (!started && info?.played)}
    <section class="end">
      <div class="card">
        <span class="riso big" data-t={String(outcome?.points ?? info?.mine?.points ?? 0)}>{outcome?.points ?? info?.mine?.points ?? 0}</span>
        <div class="grid" aria-label="Résultat case par case">{#each grid as g, i (i)}<i class="g{g}"></i>{/each}</div>
        {#if outcome?.rank || info?.rank}
          {@const r = outcome?.rank ? { rank: outcome.rank, players: outcome.players } : info?.rank}
          <p><b>{r?.rank}{r?.rank === 1 ? "er" : "e"}</b> sur {r?.players} joueurs aujourd'hui</p>
        {:else if !session.me}
          <p>Score non classé (invité).</p>
        {/if}
        <button class="btn" onclick={share}>{copied ? "Copié !" : "Partager"}</button>
      </div>
    </section>
  {/if}

  {#if board && (outcome || info?.played)}
    <section class="boards">
      <div>
        <h2 class="label">Classement du jour</h2>
        <ol class="lb">
          {#each board.top.slice(0, 20) as p, i (i)}
            <li class:me={p.name === session.me?.pseudo}><span class="tabnum">{i + 1}</span><span>{p.name}{p.home ? ` · ${p.home}` : ""}</span><b class="tabnum">{p.points}</b></li>
          {:else}<li>Personne encore, tu ouvres le bal.</li>{/each}
        </ol>
      </div>
      <div>
        <h2 class="label">Départements les plus forts</h2>
        <ol class="lb">
          {#each board.departements as d, i (d.code)}
            <li><span class="tabnum">{i + 1}</span><span>{d.nom} ({d.players})</span><b class="tabnum">{d.avg}</b></li>
          {:else}<li>Il faut 3 joueurs d'un même département pour qu'il apparaisse.</li>{/each}
        </ol>
      </div>
    </section>
  {/if}
</main>

<style>
  .daily { max-width: 1320px; margin: 0 auto; padding: 14px 20px 48px; display: flex; flex-direction: column; gap: 18px; }
  header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .back { background: none; border: 0; cursor: pointer; font-weight: 600; padding: 0; }
  .logo { font-size: 28px; margin-right: auto; }
  .score { font-family: var(--f-pop); font-size: 22px; }
  .intro { max-width: 640px; display: flex; flex-direction: column; gap: 14px; padding-top: 30px; }
  .intro h1 { font-size: clamp(44px, 8vw, 76px); margin: 0; }
  .intro p { margin: 0; font-size: 17px; }
  .hint { font-size: 14px !important; }
  .inline { background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; font-weight: 600; }
  .go { align-self: flex-start; font-size: 22px; }
  .wait { font-weight: 600; }
  .err { color: #b0005f; font-weight: 600; }
  .end { display: flex; justify-content: center; padding: 20px 0; }
  .card { border: 3px solid var(--ink); border-radius: var(--r); background: #fff; padding: 24px 28px; display: flex; flex-direction: column; align-items: center; gap: 14px; box-shadow: 6px 6px 0 var(--pink); }
  .card p { margin: 0; }
  .big { font-size: 84px; }
  .grid { display: flex; gap: 6px; }
  .grid i { width: 26px; height: 26px; border: 2px solid var(--ink); border-radius: 6px; }
  .g2 { background: var(--blue); } .g1 { background: var(--yellow); } .g0 { background: var(--pink); }
  .boards { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; max-width: 900px; width: 100%; margin: 0 auto; }
  h2 { margin: 0 0 8px; }
  .lb { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .lb li { display: grid; grid-template-columns: 28px 1fr auto; gap: 8px; padding: 4px 8px; border-radius: 8px; }
  .lb li.me { background: var(--yellow); }
  @media (max-width: 700px) { .boards { grid-template-columns: 1fr; } }
</style>
