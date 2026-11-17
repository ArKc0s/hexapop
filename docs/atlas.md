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
- Étapes : (A) socle des atlas, accueil par atlas, premier lancement, Régions jouable en Continuer et Entraînement,
  Album et carte par atlas ; (B) défi du jour par atlas et Hall of Fame ; (C) pages de référencement Régions,
  tenue d'Hexa. Chaque étape est testée en préprod avant la prod.
