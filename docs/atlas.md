# Les atlas : conception (validée avec Léo le 2026-11-17)

Remplace les règles 5 à 7 de la feuille de route (« la France d'abord, les autres en plus »), à la suite de la remarque
de Mathis : *« faut que ce soit vraiment bien cluster les différents modes de jeu, y a des users ils vont vraiment faire
que des pays ou que des départements et s'en battre les couilles du reste »*.

## Les décisions
1. **Un atlas = un monde.** L'accueil montre un seul atlas à la fois. Continuer, la carte « Ta France », le défi du
   jour, l'Entraînement, l'Album et le Hall of Fame concernent l'atlas affiché. Un sélecteur en haut de l'accueil
   permet d'en changer ; les autres atlas ne s'imposent jamais.
2. **Au premier lancement : « Qu'est-ce que tu veux apprendre ? »** Le joueur choisit son atlas (Départements par
   défaut). Le choix est gardé (et synchronisé avec le compte).
3. **Communs à tous les atlas : la série (flamme) et les kilomètres** (une seule route pour Hexa). Jouer n'importe
   quel atlas garde la flamme et fait avancer Hexa. Tout le reste est propre à chaque atlas : étoiles, médailles,
   pourcentage, révisions, Album.
4. **Un défi du jour par atlas**, chacun avec son classement par niveau. Le bouton Défi de l'accueil ouvre celui de
   l'atlas affiché. Les petits atlas ont un défi plus court (Régions : 5 questions).
5. **Préprod d'abord.** Tout passe par preprod.hexapop.app (branche `atlas`, `deploy/preprod.sh`) avant la prod.

## Ce qui ne change pas
Les règles d'un atlas (feuille de route) : une carte, une liste plate de choses à apprendre, des facettes fixées dès
sa création (base, puis expert pour l'or), bronze / argent / or, rien de verrouillé, peu d'atlas au total.

## Atlas 2 : Régions de France
| | |
|---|---|
| Promesse | « Les 18 régions, leur chef-lieu, ce qu'elles contiennent » |
| Choses à apprendre | 18 régions (13 en métropole, 5 en outre-mer) |
| Facettes de base (étoiles) | la placer sur la carte, son chef-lieu |
| Facettes expert (or) | ses départements, les régions voisines |
| Indices | le nom, la carte, le chef-lieu |
| Séances | métropole, puis outre-mer |
| Défi du jour | 5 régions, mêmes règles de niveau |

## Mise en œuvre
- Chaque chose à apprendre a un code unique dans tout le jeu : les régions sont préfixées (`R53` = Bretagne), pour ne
  jamais se mélanger avec les départements (la région 11 n'est pas l'Aude). La connaissance reste une seule fiche par
  code ; chaque atlas ne regarde que ses codes.
- Un atlas décrit : ses éléments, ses facettes, ses indices, les intitulés (« Chef-lieu » au lieu de « Préfecture »),
  ses groupes pour les séances, et sa carte.
- Livré en préprod (v1.16, 2026-11-17) : socle des atlas ; accueil par atlas avec sélecteur ; premier lancement
  « Qu'est-ce que tu veux apprendre ? » ; Régions jouable partout (Continuer, Entraînement, Album, carte) ; défi du jour
  par atlas (clé « regions:AAAA-MM-JJ » en base, classement à part) ; Entre amis sur l'atlas choisi par l'hôte (chacun
  à son niveau dans cet atlas) ; Hall of Fame par atlas (Légendes Régions, Marathon réservé aux départements) ;
  pages de référencement (/france/regions, /quiz/regions, /quiz/chefs-lieux-des-regions) ; Hexa en bob d'explorateur
  dans l'atlas Régions ; rappels (notifications) aux mots de l'atlas du joueur ; stats Grafana du défi Régions.

## Atlas 3 : Monde (en essai, préprod seulement)
Demandé par Léo le 2026-11-18 « pour voir ce que ça donnerait » ; la première sortie des atlas ne proposera que
Régions. `preview: true` dans `atlas.ts` : le Monde n'apparaît que sur preprod.hexapop.app (et en local), jamais en prod.

| | |
|---|---|
| Promesse | « Les 195 pays, leur capitale et leur drapeau » |
| Choses à apprendre | 195 pays : les 193 membres de l'ONU, plus le Vatican et la Palestine (États observateurs) |
| Facettes de base (étoiles) | le placer, son drapeau, sa capitale |
| Facettes expert (or) | ses pays voisins (frontières terrestres ; les îles n'en ont pas) |
| Indices | le nom, la carte, le drapeau, la capitale |
| Séances | un continent à la fois : Europe, Afrique, Asie, Amérique du Nord et centrale, Amérique du Sud, Océanie ; les pays connus d'abord |
| Défi du jour | 10 pays, mêmes règles de niveau |

- **Le drapeau** est une facette à part entière : on le reconnaît (indice) ou on le retrouve parmi 4 (toujours en
  propositions, même au clavier : on ne dessine pas un drapeau). Fichiers SVG de flag-icons (licence MIT),
  `apps/web/public/drapeaux/`, chargés à la demande et gardés hors ligne par le service worker.
- **La carte** : Natural Earth 1:50m (domaine public), projection Natural Earth, sans l'Antarctique. Les pays trop
  petits pour le doigt ont un rond cliquable. Les terres qui ne se jouent pas (Groenland, Sahara occidental, Kosovo,
  Taïwan, territoires d'outre-mer des autres pays…) sont en gris. À la correction, la carte zoome sur le pays.
- **Données** : `pnpm data:monde` (`data/scripts/build-monde.mjs`) ; noms, articles et capitales en français écrits à la
  main dans le script, avec les autres réponses acceptées (« RDC », « Myanmar », « La Paz »…).
- Codes préfixés « W » + code ISO à trois lettres (`WFRA`), comme « R » pour les régions.
- Hexa porte des lunettes d'aviateur dans ce monde.

**À trancher avant une éventuelle sortie** : Kosovo et Taïwan (absents de la liste, en gris sur la carte) ; Israël
(capitale « Jérusalem », « Tel Aviv » acceptée) ; Palestine (« Ramallah », « Jérusalem-Est » acceptée) ; Sahara
occidental en gris (le Maroc et la Mauritanie ne se touchent donc pas).
