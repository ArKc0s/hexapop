<script lang="ts">
  import { onDestroy } from "svelte";
  import LiveRound from "../lib/LiveRound.svelte";
  import StageView from "../lib/StageView.svelte";
  import { live } from "../lib/socket.svelte.ts";
  import { nav } from "../lib/nav.svelte.ts";

  const room = $derived(live.room);
  const me = $derived(room?.players.find((p) => p.id === live.you));
  const myRank = $derived(room && me ? room.players.indexOf(me) + 1 : 0);
  const s = $derived(live.summary);

  let now = $state(Date.now());
  const timer = setInterval(() => (now = Date.now()), 250);
  onDestroy(() => clearInterval(timer));
  const nextIn = $derived(s?.nextAt ? Math.max(0, Math.ceil((s.nextAt - (now + live.offset)) / 1000)) : 0);

  $effect(() => { if (!room) nav.go({ name: "lobby" }); else if (room.phase === "lobby") nav.go({ name: "lobby", join: room.code }); });

  function leave() { live.leave(); nav.go({ name: "home" }); }
</script>

<main class="live">
  <header>
    <button class="back" onclick={leave}>← Quitter</button>
    <span class="riso logo" data-t="HEXA">HEXA</span>
    {#if room}<span class="chip">Salon {room.code}</span>{/if}
    {#if live.question}<span class="chip tabnum">{live.question.index + 1}/{live.question.total}</span>{/if}
    {#if me}<span class="score tabnum">{me.score} pts · {myRank}{myRank === 1 ? "er" : "e"}</span>{/if}
    {#if live.status !== "open"}<span class="chip warn">Reconnexion…</span>{/if}
  </header>

  {#if live.ranking}
    <section class="end">
      <h1 class="riso" data-t={myRank === 1 ? "VICTOIRE" : "TERMINÉ"}>{myRank === 1 ? "VICTOIRE" : "TERMINÉ"}</h1>
      <ol class="rank">
        {#each live.ranking as p, i (p.id)}
          <li class:me={p.id === live.you}><span class="tabnum">{i + 1}</span><span>{p.name}</span><b class="tabnum">{p.score}</b></li>
        {/each}
      </ol>
      <div class="cta">
        {#if me?.host}<button class="btn" onclick={() => live.send({ t: "rematch" })}>Revanche</button>{:else}<span>L'hôte peut lancer une revanche.</span>{/if}
        <button class="btn ghost" onclick={leave}>Accueil</button>
      </div>
    </section>
  {:else if room?.phase === "countdown"}
    <div class="count riso" data-t="PRÊTS ?">PRÊTS ?</div>
  {:else if me?.eliminated}
    <p class="out">Éliminé ! Tu regardes la suite en spectateur.</p>
    <StageView />
  {:else}
    <LiveRound>
      {#if s && room}
        <ol class="mini">
          {#each room.players.slice(0, 8) as p, i (p.id)}
            <li class:me={p.id === live.you} class:gone={p.eliminated}>
              <span class="tabnum">{i + 1}</span><span>{p.name}</span>
              <span class="plus tabnum">{s.results[p.id] ? `+${s.results[p.id].points}` : "–"}</span><b class="tabnum">{p.score}</b>
            </li>
          {/each}
        </ol>
        {#if s.eliminated.includes(live.you ?? "")}<p class="out">Tu es éliminé à cette manche.</p>{/if}
        {#if s.nextAt}<p class="next">Tour suivant dans {nextIn} s</p>{/if}
      {/if}
    </LiveRound>
    {#if live.question && !s}
      <p class="who">{live.answered.size} joueur{live.answered.size > 1 ? "s ont" : " a"} déjà répondu</p>
    {/if}
  {/if}
</main>

<style>
  .live { max-width: 1320px; margin: 0 auto; padding: 14px 20px 40px; display: flex; flex-direction: column; gap: 14px; }
  header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .back { background: none; border: 0; cursor: pointer; font-weight: 600; padding: 0; }
  .logo { font-size: 28px; margin-right: auto; }
  .score { font-family: var(--f-pop); font-size: 20px; }
  .warn { background: var(--pink); }
  .count { font-size: clamp(80px, 16vw, 180px); text-align: center; padding: 60px 0; }
  .mini { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
  .mini li { display: grid; grid-template-columns: 24px 1fr auto 64px; gap: 8px; padding: 3px 8px; border-radius: 8px; }
  .mini li.me { background: var(--yellow); }
  .mini li.gone { opacity: .45; }
  .mini b { text-align: right; }
  .plus { color: var(--blue); font-weight: 700; }
  .next, .who { font-weight: 600; margin: 0; }
  .out { font-weight: 700; color: #b0005f; margin: 0; }
  .end { max-width: 560px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; width: 100%; }
  .end h1 { font-size: clamp(56px, 10vw, 96px); margin: 0; }
  .rank { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 18px; }
  .rank li { display: grid; grid-template-columns: 30px 1fr auto; gap: 8px; padding: 6px 10px; border-radius: 10px; border: 2px solid var(--ink); background: #fff; }
  .rank li.me { background: var(--yellow); }
  .cta { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
</style>
