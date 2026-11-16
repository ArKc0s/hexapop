# RGPD : registre des traitements et mesures

Document interne (article 30 du RGPD). À tenir à jour à chaque nouvelle donnée ou nouveau prestataire.
Dernière mise à jour : 2026-11-16.

## Responsable du traitement
L'éditeur du site (voir `apps/web/src/lib/legal.ts`). Contact : contact@hexapop.app.

## Traitements

| # | Traitement | Données | Personnes | Finalité | Base légale | Conservation | Où |
|---|---|---|---|---|---|---|---|
| 1 | Comptes joueurs | email, pseudo, empreinte du mot de passe, département de cœur (facultatif), dates de création et de dernière activité | joueurs inscrits | fournir le compte, connexion, synchronisation | contrat (CGU), art. 6.1.b | jusqu'à suppression ; 30 j si email jamais confirmé ; 3 ans sans connexion | SQLite, conteneur `hexapop` (infra, France) |
| 2 | Progression et défi du jour | état de révision par département, scores quotidiens | joueurs inscrits | sauvegarde, classements publics (pseudo, département de cœur, score) | contrat | comme le compte | idem |
| 3 | Emails transactionnels | email, pseudo | joueurs inscrits | vérification d'adresse, réinitialisation du mot de passe | contrat | jetons : 48 h / 1 h ; les emails envoyés restent chez OVH selon sa politique | OVH (France) |
| 4 | Sessions | empreinte du jeton, identifiant du compte, expiration | joueurs inscrits | rester connecté | contrat | 60 jours | SQLite |
| 5 | Sécurité | adresse IP, date, URL, user-agent | tous les visiteurs | lutte contre les abus, limitation des tentatives | intérêt légitime, art. 6.1.f | mémoire du serveur : quelques minutes ; journaux Caddy : 12 mois max (voir point ouvert) | Caddy (LXC 109), Cloudflare |
| 6 | Parties multijoueur invité | pseudo d'invité, réponses | invités | afficher le joueur, noter la partie | contrat | mémoire du serveur, le temps du salon | conteneur `hexapop` |

Pas de traitement de données sensibles, pas de profilage, pas de publicité, pas de mesure d'audience.

## Sous-traitants
- **Cloudflare, Inc.** (États-Unis) : CDN, TLS, protection. Transferts encadrés par le Data Privacy Framework et les clauses contractuelles types (DPA Cloudflare accepté avec les conditions du service).
- **OVH SAS** (France) : boîte `noreply@hexapop.app` et envoi SMTP.

## Mesures de sécurité
- HTTPS partout (Cloudflare puis Caddy, certificats Let's Encrypt), HSTS.
- Mots de passe : scrypt, N=2^15, r=8, p=3, sel de 16 octets par compte, paramètres versionnés et mis à niveau à la connexion ; comparaison en temps constant ; temps de réponse identique avec ou sans compte.
- Jetons de session et liens email stockés sous forme d'empreinte SHA-256 ; cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- Limitation des tentatives (inscription, connexion, mot de passe oublié, WebSocket).
- CSP stricte, aucune ressource tierce (polices auto-hébergées), pas de cookie non essentiel.
- Purge quotidienne automatique (`purge()` dans `apps/server/src/db.ts`).
- Base SQLite sur un volume local du conteneur ; accès restreint au compte `infra`.

## Droits des personnes
- Accès et portabilité : `GET /api/me/export` (bouton « Télécharger mes données »).
- Effacement : `DELETE /api/me` avec mot de passe (bouton « Supprimer mon compte »), suppression en cascade immédiate.
- Rectification : département de cœur modifiable ; autres demandes par email, sous un mois.

## Points ouverts
- [ ] Renseigner l'identité de l'éditeur dans `apps/web/src/lib/legal.ts` (LCEN art. 6 III).
- [ ] Créer l'adresse `contact@hexapop.app` (ou une redirection OVH).
- [ ] Journaux Caddy : ajouter une rotation par durée (`roll_keep_for 8760h`) pour garantir les 12 mois annoncés.
- [ ] Sauvegarde chiffrée de `/home/infra/hexapop/data` (aucune sauvegarde à ce jour) et procédure de restauration.
- [ ] En cas de violation de données : notification à la CNIL sous 72 h (art. 33) et aux joueurs si risque élevé.
