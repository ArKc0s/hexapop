# Suivre la fréquentation (Grafana)

Hexa compte lui-même sa fréquentation, de façon anonyme (voir `apps/server/src/stats.ts` et la page Confidentialité) :
visiteurs uniques par jour (dont appli installée), séances, entraînements, marathons, défis par niveau (et invités),
salons par type, pic de joueurs connectés, nouveaux comptes, et la liste des comptes (sans email).

Les chiffres sont servis en JSON par `GET /api/admin/stats?days=30`, protégé par un jeton (`STATS_TOKEN`, créé par
`deploy/deploy.sh` dans le `.env` d'infra, jamais affiché). Grafana les lit avec le plugin **Infinity**, sans autre service.

## Mise en place (une fois)
Le Grafana du homelab est sur `http://192.168.1.169:3000`.
1. **Plugin** : Administration › Plugins › chercher **Infinity** (yesoreyeram-infinity-datasource) › Installer.
2. **Source de données** : Connexions › Sources de données › Ajouter › Infinity, nommée « Hexa » :
   - Authentification : **Bearer Token**, coller le jeton (`ssh infra 'grep ^STATS_TOKEN= /home/infra/hexapop/.env'`) ;
   - Hôtes autorisés (Allowed hosts) : `http://192.168.1.103:8787` ;
   - URL de base (Base URL) : `http://192.168.1.103:8787` ;
   - Enregistrer et tester.
3. **Tableau de bord** : Tableaux de bord › Nouveau › Importer › `deploy/grafana/hexa-dashboard.json`, choisir la source « Hexa ».

## Ce qu'on voit
| Panneau | Contenu |
|---|---|
| En direct (haut du tableau, rafraîchi toutes les 30 s) | en ligne maintenant, en partie solo, défis du jour en cours, joueurs entre amis ; où sont les joueurs (accueil, séance, entraînement, marathon, révisions, défi, entre amis) ; salons en cours par type ; courbe minute par minute sur 24 h. Source : `GET /api/admin/live?hours=24` (même jeton) |
| Chiffres clés | visiteurs du jour, sur 30 jours, séances du jour, comptes, nouveaux comptes, pic de joueurs en direct |
| Visiteurs uniques par jour | dont ceux qui jouent depuis l'appli installée |
| Parties solo | séances (Continuer), entraînement, marathon, révisions |
| Défi du jour | par niveau, et parties d'invités (non classées) |
| Entre amis | salons créés par type, pic de joueurs connectés |
| Comptes | pseudo, département, mode de connexion, vérifié, défis joués, dates |

## Notes
- Les visiteurs du jour en cours sont calculés en direct ; les jours passés sont des totaux (les empreintes du jour sont effacées le lendemain).
- « En direct » : chaque onglet ouvert signale son écran toutes les minutes (identifiant tiré au hasard à chaque chargement, gardé 2 minutes en mémoire, voir `apps/server/src/live.ts`). Une mesure par minute est gardée 14 jours (table `stats_live`). Pendant une mise à jour, les salons qui finissent sur l'ancienne version n'apparaissent pas dans les chiffres en direct.
- Les parties solo ne sont comptées que depuis la v1.10 (17/11/2026 vers 11 h 40).
- Pendant une mise à jour, les deux versions écrivent dans la même base : les compteurs restent justes.
