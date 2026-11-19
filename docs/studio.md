# Studio : les reels automatiques

Le studio (`apps/studio`) fabrique chaque nuit un reel vertical (1080 × 1920, 30 images/s, 20 à 60 s) à partir des données du jeu, le soumet à validation sur Discord, puis le publie au bon créneau.

Il tourne sur la machine **hexa-studio** (conteneur LXC 110 sur pve01, `192.168.1.21`, 2 cœurs à priorité basse, 2 Go de RAM), sous l'utilisateur `hexa`, avec le service systemd `hexa-studio`.

## Déroulé

1. **3 h** : le studio choisit le format du jour (rotation), le contenu (tiré au sort, en évitant ce qui est passé récemment), fait lire le texte à la voix du jour (Hugo et Camille en alternance, ElevenLabs v3), dessine les images, synthétise la musique et monte la vidéo. Il faut environ 2 à 3 minutes et 400 Mo de RAM.
2. Le reel arrive dans le salon privé **#studio** du Discord, avec sa légende. Réactions : ✅ publier, ❌ écarter, 🔁 en refaire un autre (3 essais par jour au maximum).
3. **Au créneau** (18 h 30 en semaine, 11 h le week-end) : un reel validé est publié sur Instagram si le compte est relié, et le studio poste un rappel avec la légende pour TikTok. Rien ne part sans ✅.

## Formats

| Format | Contenu | Données |
|---|---|---|
| `placer` | « Tu sais placer ces 5 départements ? » | départements de métropole |
| `numero` | « Le numéro mystère » : un numéro, trouver le département | numéros, préfectures |
| `prefecture` | « Préfecture ou pas ? » : la préfecture ou une sous-préfecture piège | préfectures, sous-préfectures (pièges revérifiés contre les données) |
| `vraifaux` | 4 affirmations vraies ou fausses (préfecture, numéro, région, voisins) | toutes les données |
| `region` | « Les N départements de … », allumés un par un sur la carte | régions |
| `rates` | Les départements que les joueurs ratent le plus | `GET /api/admin/rates` (totaux anonymes, à partir de 5 joueurs) |

Tout ce qui est dit vient des données du jeu ; les tests (`node --test src/*.test.ts`) revérifient chaque affirmation sur des centaines de tirages.

## Commandes

```sh
./deploy/studio.sh                                          # met à jour la machine et redémarre le service
ssh hexa@192.168.1.21 'journalctl -u hexa-studio -f'        # journal
# sur la machine, dans ~/studio/app/apps/studio, avec les variables de ~/studio/.env :
node src/index.ts make <format> [hugo|camille] [graine]     # un essai, sans Discord (dans ~/studio/data/essais)
node src/index.ts ig-token <jeton>                          # relie le compte Instagram
```

## Configuration (`~/studio/.env`, droits 600)

`ELEVEN_KEY` (ElevenLabs), `DISCORD_TOKEN` (le bot Hexa), `DISCORD_GUILD`, `HEXA_URL`, `STATS_TOKEN` (le même que le serveur, pour le format `rates`), `STUDIO_DATA`. Facultatif : `GEN_HOUR` (3), `SLOT_WEEK` (18:30), `SLOT_WEEKEND` (11:00).

## Publication

- **Instagram** : API Instagram avec connexion Instagram, envoi direct du fichier. Le jeton (60 jours) est renouvelé automatiquement ; il se donne une fois avec `ig-token`.
- **TikTok** : pour l'instant, publication à la main depuis le rappel Discord (la publication automatique demande la validation de l'appli par TikTok).
- **YouTube Shorts** : plus tard (sans audit, les vidéos envoyées par l'API restent privées).

## Coûts

ElevenLabs (offre Starter, environ 5 $ par mois, 30 000 caractères) : un reel lit 250 à 500 caractères, et les phrases déjà lues sont gardées en cache. Le reste tourne sur le homelab.
