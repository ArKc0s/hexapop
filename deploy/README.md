# Déploiement d'Hexa

Sur la machine `infra` (cible dans `deploy/.deploy.env`, non versionné), trois conteneurs :

| Conteneur | Rôle |
|---|---|
| `hexapop-router` | l'aiguilleur, sur le port 8787 (derrière Caddy) ; contrôle local sur `127.0.0.1:8786` |
| `hexapop-blue`, `hexapop-green` | deux versions du jeu, sur la même base (`data/hexa.db`) |

## Mettre à jour (à tout moment, sans coupure)
```sh
./deploy/deploy.sh
```
La nouvelle version démarre sur la couleur libre ; dès qu'elle répond, l'aiguilleur lui envoie tous les nouveaux joueurs.
L'ancienne finit ses parties en cours (un ami qui rejoint une partie en cours y est envoyé), ne crée plus de salon,
n'envoie plus de notifications, puis s'arrête seule (au plus 3 h). Le solo n'est jamais concerné.

- `ROUTER=1 ./deploy/deploy.sh` : met aussi à jour l'aiguilleur (rare). C'est la seule opération qui coupe les connexions,
  quelques secondes : refusée s'il y a des joueurs, sauf `FORCE=1`.
- Si l'ancienne version finit encore les parties de la mise à jour précédente, le script attend qu'on le relance.

## Voir l'état
```sh
ssh infra 'curl -s 127.0.0.1:8786/state'   # version active, versions en vidange, salons de chacune
```

## Règles pour que deux versions cohabitent
- **Base de données** : uniquement des ajouts compatibles (nouvelle table, nouvelle colonne avec valeur par défaut).
  Jamais renommer ni supprimer une colonne dans la même version que le code qui cesse de l'utiliser : le faire une version plus tard.
- **Protocole temps réel** : rester compatible (champs optionnels). Changer `PROTOCOL_VERSION` force les anciens clients à recharger.
- **État en mémoire** : ce qui doit survivre au changement de version va en base (ex. jetons de défi invité).

## Retour arrière
- Revenir à la version précédente : `ssh infra 'curl -X POST "127.0.0.1:8786/switch?to=<ancienne couleur>"'` tant qu'elle tourne,
  sinon redéployer le commit précédent (`git checkout <commit> && ./deploy/deploy.sh`).
- Revenir à l'ancien conteneur unique : `docker compose down`, remettre l'ancien `compose.yaml`, `docker compose up -d`.
  La base d'avant le passage aux deux versions est dans `../hexapop-avant-bleu-vert/`.
