# Hexa

**Apprendre les 101 départements français en jouant** : où ils sont, leur numéro, leur préfecture, et en mode expert leurs sous-préfectures et leurs voisins. Seul pour progresser, ou entre amis en direct.

👉 **Jouer : [hexapop.app](https://hexapop.app)**

## Le jeu
- **Tour de France** : une campagne région par région, 3 étoiles par région, les régions voisines se débloquent au fil des étoiles.
- **Défi du jour** : 10 départements, les mêmes pour tout le monde, un seul essai, résultat à partager.
- **Entre amis** : duel à points de vie, ou soirée plateau jusqu'à 100 joueurs avec option battle royale et écran à projeter ou streamer.
- **Collection** : une vignette par département (bronze, argent, or), des badges, une carte de France qui s'efface si on ne révise pas.
- **Révisions** par répétition espacée : ce que tu rates revient plus souvent.

## Signaler un bug, proposer une idée
Ouvre une [issue](https://github.com/ArKc0s/hexapop/issues/new/choose). La feuille de route est suivie dans le [projet GitHub](https://github.com/users/ArKc0s/projects) et dans [`docs/roadmap.md`](docs/roadmap.md).

## Sous le capot
Monorepo pnpm, Node 24 (TypeScript exécuté directement), sans framework serveur.

| Dossier | Rôle |
|---|---|
| `data/` | Génération des données à partir des sources officielles (`pnpm data`) |
| `packages/data` | Départements, régions, carte (JSON générés) |
| `packages/game` | Logique partagée client/serveur : questions, notation tolérante, répétition espacée, méta-jeu, protocole temps réel |
| `apps/web` | Client Svelte 5 + Vite |
| `apps/server` | API HTTP, WebSocket temps réel (le serveur tire, chronomètre et note), SQLite |
| `deploy/` | Image Docker, compose, exemple de configuration Caddy |

```sh
pnpm install
pnpm --filter @hexa/server dev   # API + WebSocket sur :8787
pnpm --filter @hexa/web dev      # client sur :5173 (proxy vers l'API)
pnpm --filter @hexa/game test && pnpm --filter @hexa/server test
```

Sans configuration SMTP, les emails (vérification, mot de passe) s'affichent dans les journaux du serveur. Les connexions Google, Discord, Twitch et Apple s'activent en renseignant leurs identifiants (voir `deploy/env.example`).

## Données et licences
- **Code** : [GNU AGPL-3.0](LICENSE). Si tu héberges une version modifiée d'Hexa, tu dois publier son code.
- **Départements, préfectures, sous-préfectures** : Code officiel géographique 2025, INSEE, [Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/).
- **Contours** : IGN ADMIN EXPRESS via [france-geojson](https://github.com/gregoiredavid/france-geojson), Licence Ouverte.
- **Polices** : Bowlby One et Gabarito, SIL Open Font License.
- Le nom et l'identité visuelle d'Hexa (logo, mascotte) ne sont pas couverts par la licence du code.
