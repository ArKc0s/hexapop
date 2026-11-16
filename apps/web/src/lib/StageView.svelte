<script lang="ts">
  // Grand écran (streamer, soirée projetée, joueurs éliminés) : ne révèle rien avant la fin du tour.
  import { onDestroy } from "svelte";
  import { dep } from "@hexa/game";
  import Map, { type Mark } from "./Map.svelte";
  import Fiche from "./Fiche.svelte";
  import { live } from "./socket.svelte.ts";

  const q = $derived(live.question);
  const s = $derived(live.summary && q && live.summary.index === q.index ? live.summary : null);
  const room = $derived(live.room);
  const active = $derived(room?.players.filter((p) => !p.eliminated) ?? []);

  let now = $state(Date.now());
  const timer = setInterval(() => (now = Date.now()), 200);
  onDestroy(() => clearInterval(timer));
  const remaining = $derived(q ? Math.max(0, Math.ceil((q.endsAt - (now + live.offset)) / 1000)) : 0);

  const marks = $derived.by(() => {
    const m: Record<string, Mark> = {};
    if (!q) return m;
    if (s) m[q.code] = "ok";
    else if (q.hint === "carte") m[q.code] = "hint";
    return m;
  });
  const fastest = $derived.by(() => {
    if (!s || !room) return [];
    return Object.entries(s.results)
      .filter(([, r]) => r.accuracy >= 0.999)
      .sort((a, b) => a[1].elapsedMs - b[1].elapsedMs)
      .slice(0, 3)
      .map(([id, r]) => ({ name: room.players.find((p) => p.id === id)?.name ?? "?", s: (r.elapsedMs / 1000).toFixed(1) }));
  });
  const eliminatedNames = $derived(s && room ? s.eliminated.map((id) => room.players.find((p) => p.id === id)?.name ?? "?") : []);
</script>

<div class="stage">
  <div class="mapside"><Map {marks} interactive={false} label="Carte du plateau" /></div>
  <aside>
    {#if room}
      <div class="joinbox"><span>Rejoins sur <b>{location.host}</b></span><span class="riso code" data-t={room.code}>{room.code}</span></div>
    {/if}

    {#if room?.phase === "countdown"}
      <div class="riso huge" data-t="PRÊTS ?">PRÊTS ?</div>
    {:else if q}
      <div class="round">Tour {q.index + 1}/{q.total}</div>
      <div class="clue">
        {#if q.hint === "numero"}<span class="riso num" data-t={q.code}>{q.code}</span>
        {:else if q.hint === "nom"}<span class="qname">{dep(q.code).nom}</span>
        {:else}<span class="qname">Ce département ?</span>{/if}
        {#if !s}<span class="timer tabnum">{remaining}</span>{/if}
      </div>
      {#if !s}
        <div class="answered">{live.answered.size}/{active.filter((p) => p.connected).length} ont répondu</div>
      {:else}
        <Fiche code={q.code} expert={false} />
        {#if fastest.length}<div class="fast">Les plus rapides : {fastest.map((f) => `${f.name} (${f.s} s)`).join(" · ")}</div>{/if}
        {#if eliminatedNames.length}<div class="out">Éliminé{eliminatedNames.length > 1 ? "s" : ""} : {eliminatedNames.join(", ")}</div>{/if}
      {/if}
    {:else if room?.phase === "lobby"}
      <div class="qname">En attente des joueurs… ({room.players.length})</div>
    {/if}

    {#if room}
      <ol class="lb">
        {#each room.players.slice(0, 10) as p, i (p.id)}
          <li class:out={p.eliminated} class:done={live.answered.has(p.id) && !s}>
            <span class="tabnum">{i + 1}</span><span>{p.name}</span><b class="tabnum">{p.score}</b>
          </li>
        {/each}
      </ol>
    {/if}
  </aside>
</div>

<style>
  .stage { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr); gap: 24px; align-items: start; }
  aside { display: flex; flex-direction: column; gap: 14px; }
  .joinbox { display: flex; justify-content: space-between; align-items: center; border: 3px solid var(--ink); border-radius: var(--r); padding: 8px 14px; background: var(--yellow); }
  .code { font-size: 44px; letter-spacing: .08em; }
  .huge { font-size: 80px; }
  .round { font-weight: 600; }
  .clue { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .num { font-size: 110px; }
  .qname { font-family: var(--f-pop); font-size: 40px; line-height: 1.02; text-transform: uppercase; }
  .timer { font-family: var(--f-pop); font-size: 56px; color: var(--pink); }
  .answered, .fast { font-weight: 600; }
  .out { font-weight: 700; color: #b0005f; }
  .lb { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 18px; }
  .lb li { display: grid; grid-template-columns: 30px 1fr auto; gap: 8px; padding: 4px 10px; border-radius: 8px; border: 2px solid transparent; }
  .lb li.done { border-color: var(--blue); }
  .lb li.out { opacity: .4; text-decoration: line-through; }
  .lb b { font-family: var(--f-pop); font-weight: 400; }
  @media (max-width: 900px) { .stage { grid-template-columns: 1fr; } }
</style>
