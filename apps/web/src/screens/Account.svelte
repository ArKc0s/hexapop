<script lang="ts">
  import { DEPARTEMENTS } from "@hexa/game";
  import { nav, type Screen } from "../lib/nav.svelte.ts";
  import { api, session, ApiError } from "../lib/api.svelte.ts";

  type View = "login" | "register" | "forgot" | "reset" | "verify" | "profile";
  let { view = "login", token, then }: { view?: View; token?: string; then?: Screen } = $props();

  // svelte-ignore state_referenced_locally
  let current = $state<View>(view);
  let email = $state(""), pseudo = $state(""), password = $state(""), login = $state("");
  let home = $state<string>("");
  let busy = $state(false);
  let error = $state(""), info = $state("");

  const sorted = [...DEPARTEMENTS].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  $effect(() => {
    if (current === "verify" && token) {
      api("POST", "/auth/verify", { token })
        .then(() => { info = "Adresse confirmée, merci !"; session.load(); })
        .catch((e) => (error = e.message));
    }
    if (current === "profile" && session.me) home = session.me.home ?? "";
  });

  async function run(fn: () => Promise<void>) {
    busy = true; error = ""; info = "";
    try { await fn(); } catch (e) { error = e instanceof ApiError ? e.message : "Erreur inattendue."; } finally { busy = false; }
  }
  const done = () => nav.go(then ?? { name: "home" });

  const submitLogin = (e: Event) => { e.preventDefault(); run(async () => { await session.login(login, password); done(); }); };
  const submitRegister = (e: Event) => { e.preventDefault(); run(async () => { await session.register(email, pseudo, password, home || null); done(); }); };
  const submitForgot = (e: Event) => { e.preventDefault(); run(async () => { await api("POST", "/auth/forgot", { email }); info = "Si un compte existe pour cette adresse, un lien vient de partir. Pense aux spams."; }); };
  const submitReset = (e: Event) => { e.preventDefault(); run(async () => { await api("POST", "/auth/reset", { token, password }); await session.load(); info = "Mot de passe changé, tu es connecté."; }); };
  const saveHome = () => run(async () => { await session.setHome(home || null); info = "Département de cœur enregistré."; });
  const resend = () => run(async () => { await api("POST", "/auth/resend"); info = "Email renvoyé."; });
</script>

<main class="acc">
  <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
  <h1 class="display">{current === "register" ? "Créer un compte" : current === "profile" ? "Ton compte" : current === "forgot" || current === "reset" ? "Mot de passe" : "Connexion"}</h1>

  {#if current === "login"}
    <form onsubmit={submitLogin}>
      <label class="label" for="a-login">Email ou pseudo</label>
      <input id="a-login" class="field" autocomplete="username" bind:value={login} required />
      <label class="label" for="a-pw">Mot de passe</label>
      <input id="a-pw" class="field" type="password" autocomplete="current-password" bind:value={password} required />
      <button class="btn accent" disabled={busy}>Se connecter</button>
    </form>
    <div class="links"><button onclick={() => (current = "register")}>Créer un compte</button><button onclick={() => (current = "forgot")}>Mot de passe oublié</button></div>
  {:else if current === "register"}
    <p>Un compte garde ta progression sur tous tes appareils et t'inscrit aux classements.</p>
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
      <button class="btn accent" disabled={busy}>Créer mon compte</button>
    </form>
    <div class="links"><button onclick={() => (current = "login")}>J'ai déjà un compte</button></div>
  {:else if current === "forgot"}
    <form onsubmit={submitForgot}>
      <label class="label" for="f-email">Ton email</label>
      <input id="f-email" class="field" type="email" autocomplete="email" bind:value={email} required />
      <button class="btn" disabled={busy}>Recevoir un lien</button>
    </form>
    <div class="links"><button onclick={() => (current = "login")}>Retour à la connexion</button></div>
  {:else if current === "reset"}
    <form onsubmit={submitReset}>
      <label class="label" for="n-pw">Nouveau mot de passe</label>
      <input id="n-pw" class="field" type="password" autocomplete="new-password" bind:value={password} minlength="8" required />
      <button class="btn" disabled={busy}>Changer le mot de passe</button>
    </form>
  {:else if current === "verify"}
    {#if !info && !error}<p>Vérification…</p>{/if}
  {:else if current === "profile" && session.me}
    <div class="profile">
      <p><b>{session.me.pseudo}</b> · {session.me.email}</p>
      {#if !session.me.emailVerified}
        <p class="warn">Adresse pas encore confirmée. <button class="inline" onclick={resend} disabled={busy}>Renvoyer l'email</button></p>
      {/if}
      <label class="label" for="p-home">Département de cœur</label>
      <div class="row">
        <select id="p-home" class="field" bind:value={home}>
          <option value="">Aucun</option>
          {#each sorted as d (d.code)}<option value={d.code}>{d.nom} ({d.code})</option>{/each}
        </select>
        <button class="btn ghost" onclick={saveHome} disabled={busy}>Enregistrer</button>
      </div>
      <button class="btn ghost" onclick={() => session.logout().then(() => nav.go({ name: "home" }))}>Se déconnecter</button>
    </div>
  {/if}

  {#if error}<p class="err" role="alert">{error}</p>{/if}
  {#if info}<p class="info" role="status">{info}</p>{/if}
</main>

<style>
  .acc { max-width: 520px; margin: 0 auto; padding: 28px 20px 60px; display: flex; flex-direction: column; gap: 16px; }
  .back { align-self: flex-start; }
  h1 { font-size: 40px; margin: 0; text-transform: uppercase; }
  form, .profile { display: flex; flex-direction: column; gap: 8px; }
  form .btn { margin-top: 10px; align-self: flex-start; }
  select.field { font-size: 16px; }
  .links { display: flex; gap: 16px; flex-wrap: wrap; }
  .links button, .inline { background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; font-weight: 600; }
  .row { display: flex; gap: 10px; align-items: center; }
  p { margin: 0; }
  .err { color: #b0005f; font-weight: 600; }
  .info { color: var(--blue); font-weight: 600; }
  .warn { font-size: 14px; }
</style>
