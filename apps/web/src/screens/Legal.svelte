<script lang="ts">
  import { nav } from "../lib/nav.svelte.ts";
  import { EDITEUR, MAJ, SOUS_TRAITANTS } from "../lib/legal.ts";

  export type Doc = "mentions" | "confidentialite" | "cgu";
  let { doc }: { doc: Doc } = $props();
  const TITLES: Record<Doc, string> = { mentions: "Mentions légales", confidentialite: "Confidentialité", cgu: "Conditions d'utilisation" };
</script>

<main class="legal">
  <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
  <nav class="tabs" aria-label="Documents légaux">
    {#each Object.entries(TITLES) as [k, t] (k)}
      <button class="chip" class:on={doc === k} onclick={() => nav.go({ name: "legal", doc: k as Doc })}>{t}</button>
    {/each}
  </nav>
  <h1 class="display">{TITLES[doc]}</h1>
  <p class="maj">Dernière mise à jour : {MAJ}</p>

  {#if doc === "mentions"}
    <h2>Éditeur</h2>
    <p>Hexa (hexapop.app) est un site non commercial, édité à titre personnel par :</p>
    <ul>
      <li>{EDITEUR.nom}, particulier</li>
      <li>Contact : {EDITEUR.contact}</li>
    </ul>
    <p>Directeur de la publication : {EDITEUR.nom}.</p>

    <h2>Hébergement</h2>
    <p>Le site et ses données sont hébergés en France, sur un serveur exploité par l'éditeur.</p>
    <p>Diffusion et protection : Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis.</p>
    <p>Envoi des emails : OVH SAS, 2 rue Kellermann, 59100 Roubaix, France.</p>

    <h2>Sources des données</h2>
    <p>Départements, préfectures et sous-préfectures : Code officiel géographique 2025, INSEE, Licence Ouverte 2.0.
      Contours : IGN ADMIN EXPRESS via le projet france-geojson, Licence Ouverte. Les données ont été simplifiées pour le jeu.</p>
    <p>Polices : Bowlby One, Schibsted Grotesk, IBM Plex Mono, sous licence SIL Open Font License.</p>

    <h2>Signaler un contenu</h2>
    <p>Pour signaler un pseudo ou un contenu illicite, écris à {EDITEUR.contact} en précisant le pseudo et la page concernée.</p>
  {:else if doc === "confidentialite"}
    <p class="lead">En bref : on ne collecte que ce qui sert au jeu. Pas de publicité, pas de traceur, pas de mesure d'audience, rien n'est revendu.</p>

    <h2>Responsable du traitement</h2>
    <p>L'éditeur du site (voir les <button class="link" onclick={() => nav.go({ name: "legal", doc: "mentions" })}>mentions légales</button>), joignable à {EDITEUR.contact}.</p>

    <h2>Ce qui est collecté, pourquoi, sur quelle base</h2>
    <div class="table">
      <table>
        <thead><tr><th>Données</th><th>Pour quoi faire</th><th>Base légale</th><th>Durée</th></tr></thead>
        <tbody>
          <tr><td>Email, pseudo, mot de passe (haché), département de cœur (facultatif)</td><td>Créer et sécuriser ton compte, te connecter</td><td>Exécution du contrat (les conditions d'utilisation)</td><td>Jusqu'à la suppression du compte, ou 3 ans sans connexion. Compte jamais confirmé : 30 jours.</td></tr>
          <tr><td>Progression, résultats du défi du jour</td><td>Sauvegarder ta progression, établir les classements</td><td>Exécution du contrat</td><td>Comme le compte</td></tr>
          <tr><td>Emails de vérification et de mot de passe oublié</td><td>Confirmer ton adresse, récupérer ton compte</td><td>Exécution du contrat</td><td>Liens valables 48 h et 1 h</td></tr>
          <tr><td>Adresse IP, date, page demandée</td><td>Sécurité du site, lutte contre les abus</td><td>Intérêt légitime</td><td>12 mois maximum (journaux techniques)</td></tr>
          <tr><td>Pseudo d'invité en partie multijoueur</td><td>Afficher ton nom aux autres joueurs</td><td>Exécution du contrat</td><td>Le temps de la partie (mémoire du serveur uniquement)</td></tr>
        </tbody>
      </table>
    </div>
    <p><b>Sans compte</b>, ta progression reste uniquement dans ton navigateur et n'est jamais envoyée.</p>
    <p><b>Ce qui est public</b> : ton pseudo, ton département de cœur et tes scores apparaissent dans les classements et dans les salons. Ton email ne l'est jamais.</p>

    <h2>Mots de passe et sécurité</h2>
    <p>Ton mot de passe n'est jamais stocké : seule une empreinte irréversible est conservée (scrypt avec un sel unique par compte, paramètres recommandés par l'OWASP). Personne, pas même l'éditeur, ne peut le retrouver. Les jetons de connexion et les liens envoyés par email sont eux aussi stockés sous forme d'empreinte. Toutes les communications sont chiffrées (HTTPS).</p>

    <h2>Qui y a accès</h2>
    <p>Seul l'éditeur. Deux prestataires techniques interviennent pour son compte :</p>
    <ul>{#each SOUS_TRAITANTS as s (s.nom)}<li><b>{s.nom}</b> : {s.role}. {s.lieu}</li>{/each}</ul>

    <h2>Cookies et stockage local</h2>
    <p>Le site n'utilise que des éléments strictement nécessaires à son fonctionnement, exemptés de consentement : c'est pourquoi il n'y a pas de bandeau cookies.</p>
    <ul>
      <li><b>hexa_session</b> : cookie qui te garde connecté, 60 jours.</li>
      <li><b>Stockage local du navigateur</b> : ta progression, ton pseudo d'invité, ta reprise de partie en cas de coupure.</li>
      <li><b>Cookies techniques de Cloudflare</b> (par exemple __cf_bm) : protection contre les robots.</li>
    </ul>

    <h2>Tes droits</h2>
    <p>Tu peux accéder à tes données, les rectifier, les effacer, les récupérer (portabilité), ou t'opposer à un traitement ou en demander la limitation.</p>
    <ul>
      <li><b>Directement depuis ton compte</b> : télécharger toutes tes données, ou supprimer ton compte (effacement immédiat et définitif).</li>
      <li><b>Pour toute autre demande</b> : {EDITEUR.contact}. Réponse sous un mois.</li>
      <li>Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL (cnil.fr, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07).</li>
    </ul>

    <h2>Mineurs</h2>
    <p>Si tu as moins de 15 ans, demande l'accord d'un parent avant de créer un compte. Tu peux jouer sans compte.</p>
  {:else}
    <h2>Le service</h2>
    <p>Hexa est un jeu gratuit pour apprendre les départements français, seul ou à plusieurs. On peut jouer sans compte ; un compte permet de sauvegarder sa progression et d'apparaître dans les classements.</p>

    <h2>Ton compte</h2>
    <ul>
      <li>Tu fournis une adresse email valide qui t'appartient, et tu gardes ton mot de passe secret.</li>
      <li>Un compte par personne.</li>
      <li>Tu peux supprimer ton compte à tout moment depuis la page « Ton compte ».</li>
    </ul>

    <h2>Pseudos et comportement</h2>
    <p>Sont interdits : les pseudos injurieux, discriminatoires, à caractère sexuel ou usurpant l'identité d'autrui, ainsi que toute tentative de triche (scripts, robots, exploitation de failles) ou de perturbation du service. L'éditeur peut renommer un pseudo, retirer un score ou suspendre un compte qui ne respecte pas ces règles.</p>

    <h2>Disponibilité et responsabilité</h2>
    <p>Hexa est un projet personnel, fourni tel quel et sans garantie de disponibilité. Les données géographiques proviennent de sources officielles (INSEE, IGN), mais peuvent comporter des erreurs ou des simplifications : elles ne font pas foi.</p>

    <h2>Propriété</h2>
    <p>Le jeu, son code et son identité visuelle appartiennent à l'éditeur. Les données publiques restent sous leur licence d'origine (voir les mentions légales).</p>

    <h2>Évolution et droit applicable</h2>
    <p>Ces conditions peuvent évoluer ; la date de mise à jour figure en haut de page. Elles sont soumises au droit français.</p>
  {/if}
</main>

<style>
  .legal { max-width: 760px; margin: 0 auto; padding: 24px 20px 64px; display: flex; flex-direction: column; gap: 12px; }
  .back { align-self: flex-start; }
  .tabs { display: flex; gap: 6px; flex-wrap: wrap; }
  h1 { font-size: clamp(34px, 6vw, 48px); text-transform: uppercase; margin-top: 8px; }
  .maj { margin: -4px 0 8px; color: var(--ink-soft); font-size: 14px; }
  h2 { font-size: 19px; font-weight: 800; margin: 18px 0 0; }
  p, li { max-width: 68ch; margin: 0; }
  ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
  .lead { font-size: 18px; font-weight: 500; }
  .table { overflow-x: auto; }
  table { border-collapse: collapse; font-size: 14px; min-width: 620px; }
  th, td { text-align: left; vertical-align: top; padding: 8px 10px 8px 0; border-bottom: 1px solid var(--line); }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-soft); }
</style>
