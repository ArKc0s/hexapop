<script lang="ts">
  import { REGIONS, type RoomSettings } from "@hexa/game";
  import { live } from "../lib/socket.svelte.ts";
  import { session } from "../lib/api.svelte.ts";
  import { nav } from "../lib/nav.svelte.ts";

  let { join }: { join?: string } = $props();

  const NAME_KEY = "hexa.guestName";
  let name = $state((() => { try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; } })());
  // svelte-ignore state_referenced_locally
  let code = $state(join ?? "");
  let copied = $state(false);

  const room = $derived(live.room);
  const me = $derived(room?.players.find((p) => p.id === live.you));
  const isHost = $derived(!!me?.host);
  const link = $derived(room ? `${location.origin}/#salon=${room.code}` : "");

  function connectThen(fn: () => void) {
    if (!session.me) { try { localStorage.setItem(NAME_KEY, name); } catch { /* rien */ } }
    live.connect(session.me?.pseudo ?? name, fn);
  }
  const create = (kind: "duel" | "plateau") => connectThen(() => live.create(kind));
  const doJoin = (spectate = false) => connectThen(() => live.join(code.trim(), spectate));

  // Lien d'invitation ouvert par un joueur connecté ou ayant déjà un pseudo : on rejoint directement.
  // svelte-ignore state_referenced_locally
  if (join && (session.me || name)) doJoin();

  $effect(() => { if (room && room.phase !== "lobby" && room.phase !== "ended") nav.go({ name: "live" }); });
  $effect(() => { if (room) history.replaceState(null, "", `#salon=${room.code}`); });

  function set(patch: Partial<RoomSettings>) { live.send({ t: "settings", settings: patch }); }
  function toggleRegion(r: string) {
    const cur = room?.settings.regions ?? [];
    set({ regions: cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r] });
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); copied = true; setTimeout(() => (copied = false), 2000); } catch { /* refusé */ }
  }
  function leave() { live.leave(); nav.go({ name: "home" }); }
</script>

<main class="lobby">
  <button class="back" onclick={leave}>← Accueil</button>

  {#if !room}
    <h1 class="title">Entre amis</h1>
    {#if !session.me}
      <label class="label" for="l-name">Ton pseudo</label>
      <input id="l-name" class="field" maxlength="20" placeholder="ex. Inès" bind:value={name} />
      {#if name.trim().length < 2}<p class="hint">Choisis un pseudo pour créer ou rejoindre un salon, ou <button class="link" onclick={() => nav.go({ name: "account", view: "login", then: { name: "lobby" } })}>connecte-toi</button>.</p>{/if}
    {/if}
    <div class="choices">
      <button class="btn big door" onclick={() => create("duel")} disabled={!session.me && name.trim().length < 2}>
        <b>Créer un duel</b><span>À deux : barres de vie. À plusieurs : course aux points.</span>
      </button>
      <button class="btn blue big door" onclick={() => create("plateau")} disabled={!session.me && name.trim().length < 2}>
        <b>Soirée plateau</b><span>Élimination à chaque manche jusqu'au dernier survivant. Idéal pour streamer.</span>
      </button>
    </div>
    <div class="join">
      <label class="label" for="l-code">Rejoindre avec un code</label>
      <div class="row">
        <input id="l-code" class="field code" maxlength="4" placeholder="ABCD" bind:value={code} autocapitalize="characters" />
        <button class="btn" onclick={() => doJoin()} disabled={code.trim().length !== 4 || (!session.me && name.trim().length < 2)}>Rejoindre</button>
      </div>
    </div>
    {#if live.error}
      <p class="err" role="alert">{live.error.message}
        {#if live.error.code === "already_started"}<button class="link" onclick={() => doJoin(true)}>Regarder en spectateur</button>{/if}
      </p>
    {/if}
  {:else}
    <div class="head">
      <div>
        <span class="label">{room.kind === "plateau" ? "Soirée plateau" : "Duel"} · code du salon</span>
        <div class="riso bigcode" data-t={room.code}>{room.code}</div>
      </div>
      <div class="share">
        <button class="btn white" onclick={copy}>{copied ? "Lien copié !" : "Copier le lien"}</button>
        <a class="btn white" href={`#plateau=${room.code}`} target="_blank" rel="noopener">Écran plateau ↗</a>
      </div>
    </div>

    <section class="players">
      <h2 class="label">Joueurs ({room.players.length}){room.spectators ? ` · ${room.spectators} spectateur${room.spectators > 1 ? "s" : ""}` : ""}</h2>
      <ul>
        {#each room.players as p (p.id)}
          <li class:me={p.id === live.you}><span class="av">{p.name.slice(0, 1).toUpperCase()}</span>{p.name}{p.home ? ` · ${p.home}` : ""}{p.host ? " (hôte)" : ""}</li>
        {/each}
      </ul>
    </section>

    <section class="rules">
      <h2 class="label">Règles {isHost ? "" : "(choisies par l'hôte)"}</h2>
      <div class="opts">
        <button class="chip" class:on={room.settings.level === "normal"} disabled={!isHost} onclick={() => set({ level: "normal" })}>Normal</button>
        <button class="chip" class:on={room.settings.level === "expert"} disabled={!isHost} onclick={() => set({ level: "expert" })}>Expert</button>
        <span class="sep"></span>
        <button class="chip" class:on={room.settings.input === "libre"} disabled={!isHost} onclick={() => set({ input: "libre" })}>Au clavier</button>
        <button class="chip" class:on={room.settings.input === "choix"} disabled={!isHost} onclick={() => set({ input: "choix" })}>Choix</button>
        <span class="sep"></span>
        {#each [10, 20, 50, 101] as n (n)}
          <button class="chip" class:on={room.settings.rounds === n} disabled={!isHost} onclick={() => set({ rounds: n })}>{n} tours</button>
        {/each}
        <span class="sep"></span>
        <button class="chip" class:on={room.settings.elimination} disabled={!isHost} onclick={() => set({ elimination: !room.settings.elimination })}>Élimination {room.settings.elimination ? "oui" : "non"}</button>
      </div>
      <details>
        <summary class="label">Régions {room.settings.regions.length ? `(${room.settings.regions.length})` : "(toute la France)"}</summary>
        <div class="opts">
          {#each REGIONS as r (r.code)}
            <button class="chip" class:on={room.settings.regions.includes(r.code)} disabled={!isHost} onclick={() => toggleRegion(r.code)}>{r.nom}</button>
          {/each}
        </div>
      </details>
    </section>

    {#if isHost}
      <button class="btn go" onclick={() => live.send({ t: "start" })}>Lancer la partie</button>
    {:else}
      <p class="wait">En attente du lancement par l'hôte…</p>
    {/if}
    {#if live.error}<p class="err" role="alert">{live.error.message}</p>{/if}
  {/if}
</main>

<style>
  .lobby { max-width: 820px; margin: 0 auto; padding: 24px 20px 60px; display: flex; flex-direction: column; gap: 16px; }
  .back { align-self: flex-start; }
  h1 { font-size: clamp(40px, 7vw, 60px); text-transform: uppercase; }
  .choices { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .door { flex-direction: column; align-items: flex-start; text-align: left; gap: 4px; padding: 18px; }
  .door b { font-size: 22px; font-weight: 900; }
  .door span { font-size: 14px; font-weight: 600; opacity: .9; }
  .join { display: flex; flex-direction: column; gap: 6px; }
  .row { display: flex; gap: 10px; }
  .code { max-width: 140px; text-transform: uppercase; letter-spacing: .2em; font-family: var(--f-ui); font-weight: 600; }
  .err { color: #b0005f; font-weight: 600; margin: 0; }
  
  .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
  .bigcode { font-size: clamp(64px, 12vw, 110px); letter-spacing: .08em; }
  .share { display: flex; gap: 10px; flex-wrap: wrap; }
  .share a { text-decoration: none; color: inherit; }
  h2 { margin: 0 0 8px; }
  .players ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .players li { display: flex; align-items: center; gap: 8px; border: 1.5px solid var(--line); border-radius: 999px; padding: 3px 12px 3px 3px; font-weight: 600; background: var(--card); }
  .players li.me { background: var(--yellow); }
  .av { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 13px; background: var(--ink); color: var(--bg); }
  .opts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .opts .chip:disabled { cursor: default; }
  .sep { width: 8px; }
  details { margin-top: 10px; }
  summary { cursor: pointer; margin-bottom: 8px; }
  .go { align-self: flex-start; font-size: 22px; }
  .wait { font-weight: 600; }
  @media (max-width: 600px) { .choices { grid-template-columns: 1fr; } }
  .hint { margin: -6px 0 0; font-size: 14px; color: var(--soft); }
  @media (min-width: 701px) { .lobby { min-height: 100dvh; justify-content: center; } }
</style>
