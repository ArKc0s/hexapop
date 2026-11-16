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
  const create = (kind: "duel" | "plateau" | "coop") => connectThen(() => live.create(kind));
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
        <b>Duel</b><span>Les uns contre les autres. À deux : barres de vie.</span>
      </button>
      <button class="btn green big door" onclick={() => create("coop")} disabled={!session.me && name.trim().length < 2}>
        <b>En équipe</b><span>Ensemble contre la carte : 3 vies communes, idéal pour apprendre à deux.</span>
      </button>
      <button class="btn blue big door" onclick={() => create("plateau")} disabled={!session.me && name.trim().length < 2}>
        <b>Soirée plateau</b><span>Jusqu'à 100 joueurs, écran à projeter ou streamer, battle royale en option.</span>
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
    <div class="room">
      <section class="card codecard">
        <span class="k">{room.settings.elimination ? "Battle royale" : room.kind === "plateau" ? "Soirée plateau" : room.kind === "coop" ? "En équipe" : "Duel"} · code du salon</span>
        <div class="riso bigcode" data-t={room.code}>{room.code}</div>
        <p class="hint">Tes amis tapent ce code dans « Entre amis », ou ouvrent le lien.</p>
        <div class="share">
          <button class="btn white" onclick={copy}>{copied ? "Lien copié !" : "Copier le lien"}</button>
          <a class="btn white" href={`#plateau=${room.code}`} target="_blank" rel="noopener">Écran plateau ↗</a>
        </div>
      </section>

      <section class="card">
        <h2 class="k">Joueurs · {room.players.length}{room.spectators ? ` · ${room.spectators} spectateur${room.spectators > 1 ? "s" : ""}` : ""}</h2>
        <ul class="players">
          {#each room.players as p (p.id)}
            {@const canSet = p.id === live.you || isHost}
            <li class:me={p.id === live.you}>
              <span class="av">{p.name.slice(0, 1).toUpperCase()}</span><span class="pn">{p.name}{#if p.home}<small> · {p.home}</small>{/if}</span>{#if p.host}<span class="host">hôte</span>{/if}
              <span class="lv seg" role="group" aria-label="Niveau de {p.name}">
                <button class:on={p.level === "normal"} disabled={!canSet} onclick={() => live.send({ t: "level", player: p.id, level: "normal" })}>Normal</button>
                <button class:on={p.level === "expert"} disabled={!canSet} onclick={() => live.send({ t: "level", player: p.id, level: "expert" })}>Expert</button>
              </span>
            </li>
          {/each}
        </ul>
        {#if room.players.length < 2}<p class="hint" style="margin-top:8px">En attente d'au moins un autre joueur…</p>{/if}
        <p class="hint" style="margin-top:8px">Handicap : chacun peut jouer à son niveau. En expert, on donne en plus les sous-préfectures et les voisins, dans le même temps. Les points comptent le pourcentage de bonnes réponses, donc personne n'est avantagé.</p>
      </section>

      <section class="card rules">
        <h2 class="k">Règles{isHost ? "" : " · choisies par l'hôte"}</h2>
        <div class="rule"><span>Niveau par défaut</span><div class="seg">
          <button class:on={room.settings.level === "normal"} disabled={!isHost} onclick={() => set({ level: "normal" })}>Normal</button>
          <button class:on={room.settings.level === "expert"} disabled={!isHost} onclick={() => set({ level: "expert" })}>Expert</button></div></div>
        <div class="rule"><span>Réponses</span><div class="seg">
          <button class:on={room.settings.input === "libre"} disabled={!isHost} onclick={() => set({ input: "libre" })}>Au clavier</button>
          <button class:on={room.settings.input === "choix"} disabled={!isHost} onclick={() => set({ input: "choix" })}>4 choix</button></div></div>
        <div class="rule"><span>Tours</span><div class="seg">
          {#each [10, 20, 50, 101] as n (n)}<button class:on={room.settings.rounds === n} disabled={!isHost} onclick={() => set({ rounds: n })}>{n}</button>{/each}</div></div>
        <div class="rule"><span>Battle royale (élimination)</span><div class="seg">
          <button class:on={room.settings.elimination} disabled={!isHost} onclick={() => set({ elimination: true })}>Oui</button>
          <button class:on={!room.settings.elimination} disabled={!isHost} onclick={() => set({ elimination: false })}>Non</button></div></div>
        {#if room.settings.elimination}<p class="hint">Battle royale : à partir du 3e tour, le dernier quart du classement est éliminé à chaque tour, jusqu'au dernier survivant. Les éliminés suivent la fin en spectateurs.</p>{/if}
        <details>
          <summary class="k">Régions · {room.settings.regions.length ? room.settings.regions.length : "toute la France"}</summary>
          <div class="opts">
            {#each REGIONS as r (r.code)}
              <button class="chip" class:on={room.settings.regions.includes(r.code)} disabled={!isHost} onclick={() => toggleRegion(r.code)}>{r.nom}</button>
            {/each}
          </div>
        </details>
      </section>

      {#if isHost}
        <button class="btn big wide go" onclick={() => live.send({ t: "start" })}>Lancer la partie</button>
      {:else}
        <p class="wait">En attente du lancement par l'hôte…</p>
      {/if}
      {#if live.error}<p class="err" role="alert">{live.error.message}</p>{/if}
    </div>
  {/if}
</main>

<style>
  .lobby { max-width: 820px; margin: 0 auto; padding: 24px 20px 60px; display: flex; flex-direction: column; gap: 16px; }
  .back { align-self: flex-start; }
  h1 { font-size: clamp(40px, 7vw, 60px); text-transform: uppercase; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
  .door { flex-direction: column; align-items: flex-start; text-align: left; gap: 4px; padding: 18px; }
  .door b { font-size: 22px; font-weight: 900; }
  .door span { font-size: 14px; font-weight: 600; opacity: .9; }
  .join { display: flex; flex-direction: column; gap: 6px; }
  .row { display: flex; gap: 10px; }
  .code { max-width: 140px; text-transform: uppercase; letter-spacing: .2em; font-family: var(--f-ui); font-weight: 600; }
  .err { color: #b0005f; font-weight: 600; margin: 0; }
  
  @media (max-width: 600px) { .choices { grid-template-columns: 1fr; } }
  .hint { margin: -6px 0 0; font-size: 14px; color: var(--soft); }
  .lobby { max-width: 680px; }
  .room { display: flex; flex-direction: column; gap: 14px; }
  .codecard { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }
  .bigcode { font-size: clamp(64px, 12vw, 104px); letter-spacing: .08em; }
  .share { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .share a { text-decoration: none; }
  .card h2 { margin-bottom: 10px; }
  .players { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .players li { display: flex; align-items: center; gap: 8px; border-radius: 16px; padding: 6px 6px 6px 6px; font-weight: 800; background: var(--bg); }
  .players .pn { flex: 1; }
  .lv button { padding: 6px 10px; font-size: 13px; }
  .players li.me { background: #fff4c2; }
  .players small { color: var(--soft); font-weight: 700; }
  .host { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; background: var(--ink); color: #fff; border-radius: 999px; padding: 2px 7px; }
  .av { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-weight: 900; font-size: 13px; background: var(--blue); color: #fff; }
  .rules { display: flex; flex-direction: column; gap: 10px; }
  .rule { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; font-weight: 800; }
  .opts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .opts .chip:disabled { cursor: default; }
  details summary { cursor: pointer; }
  .wait { font-weight: 800; color: var(--soft); text-align: center; }
  .hint { color: var(--soft); font-weight: 600; font-size: 14px; }
</style>
