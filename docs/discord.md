# Le Discord d'Hexa et son bot

Serveur : « Hexa » (mode Communauté, en français), invitation permanente https://discord.gg/VBXbyXZW7t (lien sur l'accueil,
la page À propos et le pied des pages de référencement).

## Organisation
- **Bienvenue** : #règles, #annonces, #nouveautés, #roadmap (lecture seule, l'équipe et le bot écrivent).
- **Le jeu** : #défi-du-jour (lecture seule), #scores, #entre-amis, forums #idées et #bugs (un fil par sujet, étiquettes).
- **Discussion** : #général (question du jour), #hors-sujet. **Vocal** : 🎮 Soirée Entre amis. **Équipe** : #modération (privé).
- Rôles : Équipe Hexa (modération), Défi du jour et Soirées Entre amis (choisis à l'arrivée, accueil de Discord).

## Le bot (`apps/bot`, conteneur `hexapop-bot`)
Lit seulement les adresses publiques du jeu (via l'aiguilleur), garde son état dans `data/bot.json`.
- **8 h** : « Le défi n° N est arrivé » dans #défi-du-jour (mention Défi du jour) avec le podium d'hier ; **21 h** : podium du jour.
- **12 h** : question du jour dans #général (4 boutons, une réponse par personne, réponse privée, dévoilée le lendemain).
- **À chaque mise en ligne** : nouvelles entrées de la page Nouveautés (`apps/web/src/lib/news.ts`) dans #nouveautés ; roadmap
  (`docs/roadmap-publique.md`, une section `##` par encart) réécrite dans #roadmap si le fichier a changé.
- **Soirées publiques** : un admin (`HEXA_ADMINS` = identifiants de compte, dans le `.env`) coche « Soirée publique » dans une
  soirée plateau ; le bot l'annonce dans #entre-amis (mention Soirées Entre amis au plus une fois par heure), la réannonce à
  chaque nouvelle partie, et son statut affiche le lien. Liste lue sur `GET /api/rooms/public`.
- **Forums ↔ GitHub, dans les deux sens** : un nouveau fil de #bugs / #idées devient une issue (texte et pièces jointes,
  étiquettes, lien du fil, jamais le pseudo : le dépôt est public) ; une issue ouverte sur GitHub devient un fil (#bugs si
  étiquette « bug », sinon #idées) ; les messages du fil deviennent des commentaires (« Sur Discord », sans pseudo) et les
  commentaires GitHub reviennent dans le fil ; fermeture (étiquette « Corrigé ») et réouverture annoncées. Une marque
  invisible `<!-- hexa-discord -->` empêche les échos. Vérification toutes les 5 minutes.
- Commandes : `/défi`, `/classement [niveau] [période]`.

## Secrets (dans `/home/infra/hexapop/.env`, jamais dans le dépôt)
- `DISCORD_TOKEN` : jeton du bot (application « Hexa » du portail développeurs Discord). Sans lui, le bot ne démarre pas.
- `GITHUB_TOKEN` : jeton GitHub avec **Issues : lecture et écriture** sur ArKc0s/hexapop. Sans lui, pas de lien forums ↔ GitHub.
- Portail Discord, onglet Bot : activer **Message Content Intent** pour que le bot lise le premier message d'un fil (sinon
  l'issue ne contient que le titre et le lien).

## Émojis et avatar
`deploy/discord/emojis/` : `gen.py` dessine les émojis du serveur en SVG (mêmes expressions et tenues que la mascotte du
jeu : bob des Régions, lunettes d'aviateur du Monde), convertis en PNG 128 × 128 avec resvg ; envoyés sur le serveur par
l'API (`POST /guilds/{id}/emojis`). `:hexa:` `:hexa_wow:` `:hexa_hmm:` `:hexa_triste:` `:hexa_love:` `:hexa_cool:`
`:hexa_mdr:` `:hexa_salut:` `:hexa_gg:` `:hexa_bot:` `:hexa_bob:` `:hexa_aviateur:` `:medaille_bronze:` `:medaille_argent:` `:medaille_or:`.
Avatar du bot : `deploy/discord/hexa-robot.svg` (Hexa en robot : antenne, visière à LED, boulons).
