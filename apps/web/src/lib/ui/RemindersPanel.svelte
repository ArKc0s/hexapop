<script lang="ts">
  import { push, type PushPrefs } from "../push.svelte.ts";
  import { install } from "../install.svelte.ts";

  let busy = $state(false), info = $state(""), err = $state("");
  const p = $derived(push.prefs);
  const set = (patch: Partial<PushPrefs>) => run(() => push.savePrefs({ ...push.prefs, ...patch }), "Enregistré.");
  async function run(fn: () => Promise<unknown>, ok = "") {
    busy = true; info = ""; err = "";
    try { await fn(); info = ok; } catch { err = "Ça n'a pas marché, réessaie."; }
    busy = false;
  }
  const hours = Array.from({ length: 16 }, (_, i) => i + 7);
</script>

<div class="panel">
  {#if !push.supported}
    <div class="card box">
      {#if install.ios && !install.standalone}
        <b>Installe d'abord Hexa sur ton écran d'accueil</b>
        <p>Sur iPhone, les notifications ne fonctionnent que dans l'appli installée : dans Safari, touche Partager, puis « Sur l'écran d'accueil ». Ouvre ensuite Hexa depuis son icône et reviens ici.</p>
      {:else}
        <b>Ton navigateur ne permet pas les notifications.</b>
      {/if}
    </div>
  {:else if !push.available}
    <div class="card box"><b>Les notifications ne sont pas encore disponibles.</b></div>
  {:else if push.permission === "denied"}
    <div class="card box"><b>Notifications bloquées</b><p>Tu les as refusées pour Hexa. Pour les réactiver, passe par les réglages de ton téléphone ou de ton navigateur (Notifications, puis Hexa), puis reviens ici.</p></div>
  {:else if !push.endpoint}
    <div class="card box">
      <b>Les rappels sont coupés sur cet appareil.</b>
      <p>Une notification quand le défi du jour arrive, quand ta série va s'arrêter, ou si tu n'as pas joué depuis longtemps. Jamais plus d'une par jour.</p>
      <button class="btn" disabled={busy} onclick={() => run(() => push.subscribe(), "Rappels activés.")}>Activer les rappels</button>
    </div>
  {:else}
    <div class="card box">
      <label class="opt"><input type="checkbox" checked={p.daily} disabled={busy} onchange={(e) => set({ daily: e.currentTarget.checked })} />
        <span><b>Défi du jour</b><small>Si tu n'as pas encore joué, à l'heure de ton choix.</small></span></label>
      {#if p.daily}
        <label class="hour">Heure du rappel
          <select class="field" value={p.hour} disabled={busy} onchange={(e) => set({ hour: Number(e.currentTarget.value) })}>
            {#each hours as h (h)}<option value={h}>{h} h</option>{/each}
          </select>
        </label>
      {/if}
      <label class="opt"><input type="checkbox" checked={p.streak} disabled={busy} onchange={(e) => set({ streak: e.currentTarget.checked })} />
        <span><b>Série en danger</b><small>Vers 20 h, si ta série d'au moins 3 jours va s'arrêter à minuit.</small></span></label>
      <label class="opt"><input type="checkbox" checked={p.comeback} disabled={busy} onchange={(e) => set({ comeback: e.currentTarget.checked })} />
        <span><b>Retour en douceur</b><small>Après 4 jours sans jouer, puis 10 jours. Ensuite, plus rien.</small></span></label>
      <p class="fine">Au maximum une notification par jour, tous rappels confondus. Réglages propres à cet appareil.</p>
    </div>
    <div class="actions">
      <button class="link danger" disabled={busy} onclick={() => run(() => push.unsubscribe(), "Rappels coupés sur cet appareil.")}>Tout couper</button>
    </div>
  {/if}
  {#if info}<p class="ok-text">{info}</p>{/if}
  {#if err}<p class="err">{err}</p>{/if}
</div>

<style>
  .panel { display: flex; flex-direction: column; gap: 14px; }
  .box { display: flex; flex-direction: column; gap: 12px; }
  .box p, .fine { color: var(--soft); font-weight: 600; font-size: 14px; }
  .box .btn { align-self: flex-start; }
  .opt { display: flex; gap: 12px; align-items: flex-start; cursor: pointer; }
  .opt input { width: 22px; height: 22px; accent-color: var(--blue); margin-top: 2px; flex: none; }
  .opt span { display: flex; flex-direction: column; }
  .opt small { color: var(--soft); font-weight: 600; font-size: 13.5px; }
  .hour { display: flex; align-items: center; gap: 10px; font-weight: 700; padding-left: 34px; }
  .hour .field { width: auto; padding: 6px 10px; font-size: 15px; }
  .actions { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
  .danger { color: var(--pink-d) !important; }
</style>
