# Feuille de route

Idées validées avec Léo, à planifier. Mise à jour : 2026-11-16.

## Fait
- **v1.0** : solo (révisions, éclair, région, marathon), défi du jour, multi temps réel (duel, soirée plateau), comptes, RGPD.
- **v1.1** : refonte gamifiée (mascotte, boutons tactiles), XP et niveaux, série, quêtes du jour, Tour de France à étoiles, album, badges, duel à points de vie, réactions.
- **v1.1.1** : plaques à trois paliers (bronze au QCM, argent au clavier, or en expert), carte qui s'entretient (un département pas revu pâlit et ne compte plus qu'à moitié), voisins tapés au clavier en expert (nom ou numéro).

- **v1.2** : handicap par joueur en salon (points normalisés sur le pourcentage), mode « En équipe » (3 vies communes, étoiles d'équipe), mobile : une question à la fois en 4 propositions et chrono fixé en haut.

## Chantiers de game design (prioritaires)

Constat de Léo (2026-11-16) : « c'est bien, mais pas assez intuitif et ça part dans tous les sens ». Les fonctionnalités se sont empilées au fil des idées (Tour, entraînement, révisions, vignettes, badges, quêtes, niveaux, rangs, série, défi, salons…) sans vision d'ensemble. Avant d'ajouter quoi que ce soit, deux chantiers de conception, à mener sur papier (puis maquette) :

### 1. Le système de progression
- **Problème** : trop de compteurs parallèles qui mesurent des choses voisines (XP et niveaux, rangs par maîtrise, étoiles du Tour, vignettes bronze/argent/or, % de « Ta France », badges, série). Le joueur ne sait pas lequel compte ni ce qu'il doit faire ensuite.
- **À définir** : une boucle unique et lisible (« je joue → j'apprends → ça se voit → je débloque »), un seul indicateur principal de maîtrise, le rôle exact de chaque récompense (ce qu'elle mesure, ce qu'elle débloque), ce qu'on supprime ou fusionne.
- **Livrable** : une page de règles de progression (une phrase par système), puis l'interface qui en découle.

### 2. Les mécaniques et les modes de jeu
- **Problème** : beaucoup de portes d'entrée (Tour, révisions, éclair, région, marathon, défi, duel, équipe, soirée, battle royale) et des règles différentes selon les modes (indice, champs demandés, chrono, notation). Un nouveau joueur ne sait pas par où commencer.
- **À définir** : le parcours du nouveau joueur (première minute, première séance, premier retour le lendemain), le nombre de modes vraiment utiles et leur promesse en une phrase, des règles communes (un tour se joue toujours de la même façon), ce qui relève du solo, du multi, du défi.
- **Livrable** : une carte des modes, la règle d'un tour, le parcours du nouveau joueur ; tests avec des débutants (dont la copine de Léo !) avant de recoder.

### 3. Déployer sans couper les parties
- **Problème** : une mise à jour redémarre le serveur, ce qui coupe les salons en cours (duels, équipes, battle royale) ; aujourd'hui le script de déploiement refuse simplement de redémarrer s'il y a des joueurs, ce qui bloque les mises à jour pendant les soirées.
- **Pistes** : un mode « vidange » (le serveur n'ouvre plus de nouveaux salons, prévient les joueurs, attend la fin des parties puis redémarre de lui-même) ; ou deux instances en relais derrière le proxy (la nouvelle prend les nouveaux salons pendant que l'ancienne finit les siens) ; ou la sauvegarde de l'état des salons pour reprendre la partie après redémarrage (les clients se reconnectent déjà automatiquement).
- **Livrable** : une mise à jour possible à tout moment, sans partie coupée, avec un message clair aux joueurs (« nouvelle version dans 2 minutes »).

## Prochaines versions

### Progression
- **Niveaux qui débloquent des récompenses cosmétiques** : accessoires pour la mascotte, styles de plaque, thèmes de carte. Visibles par les autres joueurs en multi.
- **Ligues hebdomadaires** : groupes d'une trentaine de joueurs, montée et descente chaque semaine. À lancer quand il y aura assez de joueurs.
- **Hall of Fame** : records du Marathon 101, meilleurs scores du défi, meilleurs départements de cœur.
- **Page « Nouveautés »** (notes de version) accessible depuis l'accueil.

### Nouveaux contenus (chacun avec sa propre progression)
- **Mode Voisins** : nommer tous les voisins d'un département, à part du mode expert si celui-ci devient trop chargé.
- **Gentilés** : Finistériens, Ardéchois… (données à sourcer et vérifier : pas dans le COG de l'INSEE).
- **Chefs-lieux de région**.
- **Origine des noms** : fleuves, montagnes, anecdotes (pourquoi 2A/2B, pourquoi pas de 20).

### Plus tard
- Application mobile Flutter (v2), branchée sur la même API et le même protocole WebSocket (`packages/game/src/protocol.ts`).
