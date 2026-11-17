<script lang="ts">
  import { DEPARTEMENTS } from "@hexa/game";
  import { nav, type Screen } from "../lib/nav.svelte.ts";
  import { api, session, ApiError } from "../lib/api.svelte.ts";
  import ProviderIcon from "../lib/ui/ProviderIcon.svelte";
  import RemindersPanel from "../lib/ui/RemindersPanel.svelte";

  type View = "login" | "register" | "forgot" | "reset" | "verify" | "profile";
  let { view = "login", token, then, notice, oauthError }: { view?: View; token?: string; then?: Screen; notice?: string; oauthError?: string } = $props();

  const OAUTH_ERRORS: Record<string, string> = {
    indisponible: "Ce mode de connexion n'est pas encore disponible.",
    expire: "La connexion a pris trop de temps. Réessaie.",
    annule: "Connexion annulée.",
    email_unverified: "Ton email n'est pas vérifié chez ce service : vérifie-le là-bas, ou crée un compte classique.",
    "deja-lie": "Ce compte est déjà lié à un autre joueur Hexa.",
    "connexion-requise": "Connecte-toi d'abord pour lier un compte.",
    fournisseur: "Le service de connexion n'a pas répondu correctement. Réessaie dans un instant.",
  };
  const NAMES: Record<string, string> = { google: "Google", discord: "Discord", twitch: "Twitch", apple: "Apple" };

  // svelte-ignore state_referenced_locally
  let current = $state<View>(view);
  let email = $state(""), pseudo = $state(""), password = $state(""), login = $state(""), confirm = $state("");
  let home = $state<string>("");
  let newPseudo = $state("");
  let busy = $state(false);
  // svelte-ignore state_referenced_locally
  let error = $state(oauthError ? OAUTH_ERRORS[oauthError] ?? "La connexion a échoué." : "");
  // svelte-ignore state_referenced_locally
  let info = $state(notice?.startsWith("lie-") ? `Compte ${NAMES[notice.slice(4)] ?? ""} lié.` : "");

  const sorted = [...DEPARTEMENTS].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  $effect(() => {
    if (current === "verify" && token) {
      api("POST", "/auth/verify", { token })
        .then(() => { info = "Adresse confirmée, merci !"; session.load(); })
        .catch((e) => (error = e.message));
    }
  });
  $effect(() => {
    if (current === "profile" && session.me) { home = session.me.home ?? ""; newPseudo = session.me.pseudo; }
  });
  // Connecté pendant qu'on était sur la page de connexion (retour OAuth) : direction le profil.
  $effect(() => { if (session.me && (current === "login" || current === "register") && !busy) current = "profile"; });

  async function run(fn: () => Promise<void>) {
    busy = true; error = ""; info = "";
    try { await fn(); } catch (e) { error = e instanceof ApiError ? e.message : "Erreur inattendue."; } finally { busy = false; }
  }
  const done = () => nav.go(then ?? { name: "home" });

  const submitLogin = (e: Event) => { e.preventDefault(); run(async () => { await session.login(login, password); done(); }); };
  const submitRegister = (e: Event) => { e.preventDefault(); run(async () => { await session.register(email, pseudo, password, home || null); done(); }); };
  const submitForgot = (e: Event) => { e.preventDefault(); run(async () => { await api("POST", "/auth/forgot", { email }); info = "Si un compte existe pour cette adresse, un lien vient de partir. Pense aux spams."; }); };
  const submitReset = (e: Event) => { e.preventDefault(); run(async () => { await api("POST", "/auth/reset", { token, password }); await session.load(); info = "Mot de passe enregistré, tu es connecté."; }); };
  const saveHome = () => run(async () => { await session.setHome(home || null); info = "Département de cœur enregistré."; });
  const savePseudo = () => run(async () => { await session.setPseudo(newPseudo.trim()); info = "Pseudo changé."; });
  const setPassword = () => run(async () => { await api("POST", "/auth/forgot", { email: session.me!.email }); info = `Un lien pour choisir ton mot de passe vient de partir à ${session.me!.email}.`; });
  const unlink = (p: string) => run(async () => { await session.unlink(p); info = `Compte ${NAMES[p]} délié.`; });
  let confirmDelete = $state(false);
  const deleteAccount = (e: Event) => { e.preventDefault(); run(async () => { await api("DELETE", "/me", session.me?.hasPassword ? { password } : { confirm }); session.me = null; nav.go({ name: "home" }); }); };
  const resend = () => run(async () => { await api("POST", "/auth/resend"); info = "Email renvoyé."; });
</script>

{#snippet providerButtons(intent: "login" | "link")}
  {#if session.providers.length}
    <div class="providers">
      {#each session.providers as p (p.id)}
        <a class="btn white prov" href="/api/auth/oauth/{p.id}/start?intent={intent}"><ProviderIcon id={p.id} />Continuer avec {p.label}</a>
      {/each}
    </div>
  {/if}
{/snippet}

<main class="acc">
  <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
  <h1 class="title">{current === "register" ? "Créer un compte" : current === "profile" ? "Ton compte" : current === "forgot" || current === "reset" ? "Mot de passe" : "Connexion"}</h1>

  {#if error}<p class="err" role="alert">{error}</p>{/if}
  {#if info}<p class="info" role="status">{info}</p>{/if}

  {#if current === "login"}
    <div class="card box">
      {@render providerButtons("login")}
      {#if session.providers.length}<div class="or"><span>ou avec ton email</span></div>{/if}
      <form onsubmit={submitLogin}>
        <label class="label" for="a-login">Email ou pseudo</label>
        <input id="a-login" class="field" autocomplete="username" bind:value={login} required />
        <label class="label" for="a-pw">Mot de passe</label>
        <input id="a-pw" class="field" type="password" autocomplete="current-password" bind:value={password} required />
        <button class="btn" disabled={busy}>Se connecter</button>
      </form>
    </div>
    <div class="links"><button onclick={() => (current = "register")}>Créer un compte</button><button onclick={() => (current = "forgot")}>Mot de passe oublié</button></div>
    <!-- Sans compte, les rappels restent réglables (ils sont propres à l'appareil) -->
    <div class="links"><button onclick={() => nav.go({ name: "rappels" })}>Rappels sur cet appareil, sans compte</button></div>
  {:else if current === "register"}
    <p class="fine">Un compte garde ta progression sur tous tes appareils et t'inscrit aux classements.</p>
    <div class="card box">
      {@render providerButtons("login")}
      {#if session.providers.length}<div class="or"><span>ou avec ton email</span></div>{/if}
      <form onsubmit={submitRegister}>
        <label class="label" for="r-pseudo">Pseudo</label>
        <input id="r-pseudo" class="field" autocomplete="nickname" bind:value={pseudo} minlength="2" maxlength="20" required />
        <label class="label" for="r-email">Email</label>
        <input id="r-email" class="field" type="email" autocomplete="email" bind:value={email} required />
        <label class="label" for="r-pw">Mot de passe (8 caractères minimum)</label>
        <input id="r-pw" class="field" type="password" autocomplete="new-password" bind:value={password} minlength="8" required />
        <label class="label" for="r-home">Ton département de cœur (pour le classement des départements)</label>
        <select id="r-home" class="field" bind:value={home}>
          <option value="">Je préfère ne pas dire</option>
          {#each sorted as d (d.code)}<option value={d.code}>{d.nom} ({d.code})</option>{/each}
        </select>
        <button class="btn" disabled={busy}>Créer mon compte</button>
      </form>
    </div>
    <p class="fine">En créant un compte, tu acceptes les <button type="button" class="link" onclick={() => nav.go({ name: "legal", doc: "cgu" })}>conditions d'utilisation</button>. Ton email ne sert qu'à ton compte : voir la <button type="button" class="link" onclick={() => nav.go({ name: "legal", doc: "confidentialite" })}>politique de confidentialité</button>.</p>
    <div class="links"><button onclick={() => (current = "login")}>J'ai déjà un compte</button></div>
  {:else if current === "forgot"}
    <form class="card box" onsubmit={submitForgot}>
      <label class="label" for="f-email">Ton email</label>
      <input id="f-email" class="field" type="email" autocomplete="email" bind:value={email} required />
      <button class="btn" disabled={busy}>Recevoir un lien</button>
    </form>
    <div class="links"><button onclick={() => (current = "login")}>Retour à la connexion</button></div>
  {:else if current === "reset"}
    <form class="card box" onsubmit={submitReset}>
      <label class="label" for="n-pw">Nouveau mot de passe</label>
      <input id="n-pw" class="field" type="password" autocomplete="new-password" bind:value={password} minlength="8" required />
      <button class="btn" disabled={busy}>Enregistrer le mot de passe</button>
    </form>
  {:else if current === "verify"}
    {#if !info && !error}<p>Vérification…</p>{/if}
  {:else if current === "profile" && session.me}
    <section class="card box">
      <p class="who"><b>{session.me.pseudo}</b><span>{session.me.email}</span></p>
      {#if !session.me.emailVerified}
        <p class="warn">Adresse pas encore confirmée. <button class="link" onclick={resend} disabled={busy}>Renvoyer l'email</button></p>
      {/if}
      <label class="label" for="p-pseudo">Pseudo</label>
      <div class="row"><input id="p-pseudo" class="field" maxlength="20" bind:value={newPseudo} /><button class="btn white small" onclick={savePseudo} disabled={busy || newPseudo.trim() === session.me.pseudo}>Changer</button></div>
      <label class="label" for="p-home">Département de cœur</label>
      <div class="row">
        <select id="p-home" class="field" bind:value={home}>
          <option value="">Aucun</option>
          {#each sorted as d (d.code)}<option value={d.code}>{d.nom} ({d.code})</option>{/each}
        </select>
        <button class="btn white small" onclick={saveHome} disabled={busy}>Enregistrer</button>
      </div>
    </section>

    <section class="card box">
      <h2 class="k">Connexion</h2>
      <ul class="conn">
        <li><span>Mot de passe</span>{#if session.me.hasPassword}<em>défini</em>{:else}<button class="btn white small" onclick={setPassword} disabled={busy}>Définir un mot de passe</button>{/if}</li>
        {#each session.providers as p (p.id)}
          {@const linked = session.me.providers.includes(p.id)}
          <li>
            <span class="pv"><ProviderIcon id={p.id} />{p.label}</span>
            {#if linked}
              <span class="lk"><em>lié</em><button class="link" onclick={() => unlink(p.id)} disabled={busy}>Délier</button></span>
            {:else}
              <a class="btn white small" href="/api/auth/oauth/{p.id}/start?intent=link">Lier</a>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="fine">Lie tes comptes pour te connecter en un clic. Si un service te connecte avec la même adresse email vérifiée, il est lié automatiquement.</p>
    </section>

    <section class="rem">
      <h2 class="k">Rappels sur cet appareil</h2>
      <RemindersPanel />
    </section>

    <button class="btn white" onclick={() => session.logout().then(() => nav.go({ name: "home" }))}>Se déconnecter</button>

    <section class="card box">
      <h2 class="k">Tes données</h2>
      <p class="fine">Télécharge tout ce que Hexa sait de toi, en un fichier JSON.</p>
      <a class="btn white small" href="/api/me/export" download>Télécharger mes données</a>
      {#if !confirmDelete}
        <button class="link danger" onclick={() => (confirmDelete = true)}>Supprimer mon compte</button>
      {:else}
        <form class="danger-box" onsubmit={deleteAccount}>
          <p>La suppression est <b>immédiate et définitive</b> : compte, progression, scores et comptes liés.</p>
          {#if session.me.hasPassword}
            <label class="label" for="d-pw">Confirme avec ton mot de passe</label>
            <input id="d-pw" class="field" type="password" autocomplete="current-password" bind:value={password} required />
          {:else}
            <label class="label" for="d-confirm">Tape ton pseudo ({session.me.pseudo}) pour confirmer</label>
            <input id="d-confirm" class="field" autocomplete="off" bind:value={confirm} required />
          {/if}
          <div class="row"><button class="btn pink" disabled={busy}>Supprimer définitivement</button><button type="button" class="btn white" onclick={() => (confirmDelete = false)}>Annuler</button></div>
        </form>
      {/if}
    </section>
  {/if}
</main>

<style>
  .acc { max-width: 520px; margin: 0 auto; padding: 24px 20px 60px; display: flex; flex-direction: column; gap: 14px; }
  .back { align-self: flex-start; }
  h1 { text-transform: uppercase; }
  .box { display: flex; flex-direction: column; gap: 8px; }
  form { display: flex; flex-direction: column; gap: 8px; }
  form > .btn { margin-top: 8px; }
  select.field { font-size: 16px; }
  .providers { display: flex; flex-direction: column; gap: 4px; }
  .box .btn.white:not(.prov) { --c: var(--bg); --cd: var(--line); }
  .prov { justify-content: center; width: 100%; box-shadow: 0 4px 0 var(--line), inset 0 0 0 2px var(--line); }
  .or { display: flex; align-items: center; gap: 10px; color: var(--soft); font-weight: 700; font-size: 13px; margin: 6px 0; }
  .or::before, .or::after { content: ""; flex: 1; height: 2px; background: var(--line); }
  .links { display: flex; gap: 16px; flex-wrap: wrap; }
  .links button { background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; font-weight: 700; }
  .row { display: flex; gap: 10px; align-items: center; }
  .row .btn { margin-bottom: 4px; flex: none; }
  .who { display: flex; flex-direction: column; }
  .who b { font-size: 20px; font-weight: 900; }
  .who span { color: var(--soft); font-weight: 600; }
  .conn { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .conn li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 2px solid var(--bg); font-weight: 800; min-height: 52px; }
  .conn em { font-style: normal; color: var(--green-d); font-weight: 800; }
  .pv, .lk { display: inline-flex; align-items: center; gap: 10px; }
  .info { color: var(--green-d); font-weight: 700; }
  .warn { font-size: 14px; }
  .fine { font-size: 14px; color: var(--soft); }
  .fine .link { font-weight: 700; }
  .danger { color: var(--pink-d) !important; align-self: flex-start; margin-top: 6px; }
  .rem { display: flex; flex-direction: column; gap: 8px; }
  .danger-box { border: 2px solid var(--pink); border-radius: 18px; padding: 14px; margin-top: 8px; }
</style>
