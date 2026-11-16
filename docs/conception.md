# Hexa · Conception du jeu (refonte des modes et de la progression)

Document de travail, à valider avant de coder. Version 1 du 2026-11-16.
Il couvre les chantiers 1 (progression) et 2 (modes et mécaniques) de la [feuille de route](roadmap.md) : ils se conçoivent ensemble, parce que chaque mode nourrit la progression et que la progression décide de ce qu'on joue ensuite.

---

## 0. Ce qu'on vise

> **Partir de zéro et finir par connaître les 101 départements par cœur, sans jamais se demander « je fais quoi, là ? ».**

Cinq principes, qui servent d'arbitre pour toutes les décisions qui suivent :

1. **Une question = une chose à trouver.** Jamais trois en même temps.
2. **Le jeu choisit pour toi** ce que tu joues en solo (quoi réviser, quoi découvrir, sous quelle forme). Zéro réglage avant de jouer.
3. **Un seul indicateur de progrès**, visible partout : ta carte de France qui se remplit.
4. **Chaque récompense mesure un vrai savoir.** Pas de compteur qui monte juste parce qu'on a joué.
5. **Quatre portes d'entrée, pas plus.** Chacune a une promesse en une phrase.

---

## 1. État des lieux

### Ce qui marche (à garder)
- La **carte** comme cœur du jeu, la DA (mascotte, boutons bonbon, riso), le ressenti tactile.
- Le **défi du jour** (rituel, partage, classement) et la **série**.
- La **répétition espacée** (ce qu'on rate revient plus souvent) et l'idée que **la carte s'efface** si on ne révise pas.
- Le **multi en direct** : duel à points de vie, soirée jusqu'à 100, équipe, handicap.
- La **correction** avec la fiche du département.

### Ce qui coince

**Trop de portes.** Accueil : Jouer, Défi du jour, Entre amis, Quêtes, puis Tour de France, Entraînement, Album, Atlas, Rappels. Dans Entraînement : Révisions, Éclair, Une région, Marathon. Dans Entre amis : Duel, Équipe, Soirée (+ battle royale). Un nouveau joueur ne sait pas par où commencer, un joueur régulier ne sait pas ce qui le fait le plus progresser.

**Des réglages avant de jouer.** Normal ou expert, 4 propositions ou clavier : deux décisions qu'un débutant ne sait pas prendre, et qui changent la récompense (vignette bronze, argent ou or).

**Huit compteurs qui se marchent dessus.**

| Compteur | Ce qu'il mesure vraiment | Problème |
|---|---|---|
| XP et niveaux | le temps passé | monte même sans rien apprendre |
| Quêtes du jour | des objectifs variés | doublon avec le défi et la série |
| Étoiles de région (Tour) | la réussite d'une manche | réussir une fois ≠ savoir |
| Vignettes bronze / argent / or | le format de réponse utilisé | mesure le réglage, pas le savoir |
| « Ta France » en % | la répétition espacée | le seul vrai indicateur, mais caché à droite |
| Rangs (Touriste → Géomètre) | idem « Ta France » | doublon |
| Badges | des exploits | OK en secondaire |
| Série | l'habitude | OK |

Trois d'entre eux (étoiles, vignettes, « Ta France ») prétendent dire « tu connais ce département », et ne sont pas d'accord entre eux.

**Un tour trop chargé.** Chaque tour donne un indice (nom, numéro ou carte) et demande *tout le reste* : placer + numéro + préfecture, et en expert sous-préfectures + voisins. Pour un débutant c'est trois inconnues à la fois, 20 secondes de stress, et un écran mobile très dense. Résultat : on « réussit à 33 % » sans savoir ce qu'on a appris.

---

## 2. Ce qu'il y a à apprendre

On découpe le savoir en **facettes**. Un département, c'est :

| Facette | Question type | Niveau |
|---|---|---|
| **Carte** | « Où est le Finistère ? » | base |
| **Numéro** | « Quel est le numéro du Finistère ? » / « Quel département porte le 29 ? » | base |
| **Préfecture** | « Quelle est la préfecture du Finistère ? » / « Quimper est la préfecture de… ? » | base |
| Sous-préfectures | « Cite les sous-préfectures du Finistère » | expert |
| Voisins | « Lequel n'est pas voisin du Finistère ? » | expert |

Soit **101 × 3 = 303 facettes de base**, puis 202 facettes expert. Les futurs contenus de la feuille de route (chefs-lieux de région, gentilés…) deviennent simplement **de nouvelles facettes**, sans nouveau mode.

Le nom du département sert d'ancre : chaque question relie le nom à une facette, dans un sens ou dans l'autre (les deux sens sont tirés au hasard, ça ancre mieux).

---

## 3. La règle d'un tour (la même partout)

> **Une question, une réponse, la correction tout de suite.**

1. **Une question, une seule chose à trouver** (voir tableau ci-dessus).
2. **La forme de la réponse s'adapte à ce que tu sais déjà**, sans réglage :
   - facette jamais vue → **on te la montre d'abord** (carte « À retenir : le Finistère, c'est le 29 », 2 secondes), puis question en **4 propositions** ;
   - facette déjà réussie en propositions → **sans aide** : clavier pour le numéro et la préfecture, carte entière pour la position ;
   - pour la carte, les « 4 propositions » sont **4 départements surlignés sur la carte** : on apprend à situer sans devoir viser au pixel sur mobile.
3. **Correction immédiate** : juste ou faux, la bonne réponse, la carte qui montre le département, la mini-fiche (numéro, préfecture, région). Un geste pour continuer.
4. **Chrono** : aucun en solo (on apprend, on ne stresse pas). La vitesse ne compte qu'au défi du jour et entre amis, où elle donne un bonus de points.

Conséquences : des questions de 3 à 8 secondes, une séance de 12 questions en 2 minutes environ, un écran mobile simple (une question, une zone de réponse), et un résultat lisible (« juste » ou « faux », plus de « 33 % »).

---

## 4. La progression

### 4.1 Un seul indicateur : ta carte de France
Chaque facette de base gagnée allume **une étoile** sur son département. Un département a donc **0 à 3 étoiles** (carte, numéro, préfecture), et la carte se colore en conséquence : blanc, puis de plus en plus bleu. **« Ta France » = étoiles gagnées / 303**, affiché en grand sur l'accueil et à la fin de chaque séance.

**Gagner une étoile** = réussir la facette **sans aide** (clavier ou carte entière). Réussir en 4 propositions la fait avancer mais ne suffit pas.

**L'étoile s'entretient** (ce qui existe déjà, en plus lisible) : la répétition espacée planifie la prochaine révision ; si on la laisse passer, l'étoile **pâlit** sur la carte et revient en priorité dans la séance suivante. Une étoile revue avec succès plusieurs fois à des jours d'écart devient **dorée** (ancrée pour de bon).

### 4.2 Le niveau expert devient un contenu, pas un réglage
Quand une région a toutes ses étoiles de base, ses facettes expert (sous-préfectures, voisins) s'ouvrent. Un département maîtrisé en expert gagne une **couronne**. Le joueur avancé continue de progresser après 100 %, sans jamais avoir eu à cocher « expert ».

### 4.3 Les titres
Ils découlent directement de « Ta France » (Touriste, Routard, Facteur, Sous-préfet, Préfet, Géomètre de l'IGN) : c'est un habillage du pourcentage, pas un compteur de plus.

### 4.4 Ce qui reste à côté
- **La série** (jours d'affilée) et son joker : l'habitude. Un jour compte dès qu'on a fait une séance ou le défi.
- **Les succès** (ex-badges) : des exploits rares (Bout du monde, Inarrêtable, Marathonien…), rangés dans le profil, jamais au premier plan.

### 4.5 Ce qu'on retire ou fusionne

| Aujourd'hui | Demain |
|---|---|
| XP et niveaux | **retirés** (« Ta France » joue ce rôle, et mesure un vrai savoir) |
| Quêtes du jour | **retirées** (le défi du jour et la série portent le rendez-vous quotidien) |
| Étoiles de région du Tour | **remplacées** par les étoiles des départements de la région |
| Vignettes bronze / argent / or et Album | **remplacées** par les étoiles des départements ; l'Album fusionne avec l'Atlas |
| Rangs | **gardés**, calculés à partir de « Ta France » |
| Badges | **gardés** sous le nom de succès, en secondaire |
| Normal / expert, propositions / clavier | **supprimés** comme réglages ; le jeu adapte tout seul |

---

## 5. Les quatre portes

| Porte | Promesse en une phrase | Pour qui |
|---|---|---|
| **Continuer** (gros bouton de l'accueil) | « Ta séance de 2 minutes : on révise ce qui s'efface et on découvre la suite. » | tout le monde, tous les jours |
| **Défi du jour** | « Les mêmes 10 questions pour tout le monde, un seul essai, compare-toi. » | le rituel, le partage |
| **Entre amis** | « Joue en direct contre tes amis, ou avec eux. » | les soirées, le couple |
| **Partie libre** | « Choisis ta zone et ce que tu veux réviser. » | ceux qui veulent un contrôle précis |

### Continuer (le parcours)
- Le jeu compose la séance : **d'abord les étoiles qui pâlissent**, puis **2 ou 3 départements nouveaux** de la région en cours, puis les facettes à faire progresser.
- **Région en cours** : au départ, ta région (« Tu viens d'où ? » au premier lancement, réponse facultative), puis une région voisine, comme le Tour de France actuel. La carte de l'accueil permet de choisir une autre région à tout moment.
- C'est l'ancien Tour de France + les Révisions, fusionnés.

### Défi du jour
Inchangé dans l'esprit, aligné sur la nouvelle règle : 10 questions à une facette, avec chrono et bonus de vitesse. Les bonnes réponses comptent aussi pour les étoiles (« toute bonne réponse sans aide compte, partout »).

### Entre amis
Deux choix au lieu de trois :
- **Contre** : à 2, c'est un duel à points de vie ; à plus, c'est une soirée (option battle royale).
- **Ensemble** : l'équipe, avec les vies communes.

Le **handicap** devient automatique : chacun reçoit les questions sous la forme qui correspond à son niveau (propositions pour le débutant, clavier pour le joueur fort), et le score est normalisé.

### Partie libre
Un seul écran qui remplace Éclair, Une région et Marathon : **zone** (France, une région, outre-mer), **facettes** (carte, numéro, préfecture, expert), **longueur** (10, 20, les 101). Ça compte pour les étoiles comme le reste.

### Accueil
Le gros bouton **Continuer**, la carte « Ta France » en héros avec le pourcentage, le défi du jour et Entre amis. Partie libre, Atlas et profil en secondaire. Plus de quêtes ni de niveau.

---

## 6. Le parcours du nouveau joueur

**Première minute**
1. Ouverture : pas de compte, pas de menu. La mascotte : « Tu viens d'où ? » → il touche son département sur la carte (ou « passer »).
2. Première séance tout de suite : les 3 ou 4 départements autour de chez lui, montrés puis demandés en propositions. Impossible d'échouer franchement.
3. Fin de séance : « 4 étoiles ! Ta France : 1 % », sa région commence à se colorer.

**Première séance complète (2 minutes)** : il finit sa région de départ en propositions, et gagne ses premières étoiles sans aide sur les départements les plus faciles (le sien en premier).

**Après la séance** : la proposition de sauvegarder (compte), puis d'activer les rappels (« on te dit quand tes étoiles pâlissent »). Ce qui existe déjà, au bon moment.

**Le lendemain** : notification « 3 étoiles pâlissent + le défi n° 42 est arrivé ». Continuer → révisions d'abord, puis la suite.

**La première semaine** : 2 à 3 régions, une série de 7 jours, le premier défi partagé, le premier duel.

---

## 7. Ce que deviennent les données existantes

Personne ne doit perdre ce qu'il a gagné :
- **Répétition espacée existante** (boîte par département) → chaque facette de base hérite de la boîte de son département ; boîte ≥ 4 = étoile.
- **Vignettes** : argent ou or → 3 étoiles ; bronze → les facettes passent « vues en propositions ».
- **Étoiles de région** → la région en cours et les régions ouvertes sont conservées.
- **Badges** → succès, à l'identique.
- **XP et niveau** → affichés une dernière fois (« ancien niveau 12 »), puis retirés.
- **Série, défis joués** → conservés.

---

## 8. Livraison par étapes

1. **La nouvelle règle d'un tour** (une facette par question, réponse qui s'adapte, carte à 4 départements surlignés) dans **Partie libre**, à côté de l'existant : on la teste en vrai sans rien casser.
2. **Les étoiles par facette et « Ta France »**, avec la migration des profils.
3. **Continuer** (séance composée automatiquement) + **nouvel accueil** + premier lancement « Tu viens d'où ? ». On retire alors Tour, Entraînement, quêtes, XP, vignettes.
4. **Défi du jour et Entre amis** passés à la nouvelle règle (protocole temps réel à adapter).
5. **Facettes expert** et couronnes.

Chaque étape est jouable et déployable seule.

---

## 9. Questions ouvertes (à trancher par Léo)

1. **Une facette par question** : d'accord pour abandonner le tour « fiche complète » (placer + numéro + préfecture d'un coup) ? C'est le plus gros changement, et celui qui simplifie tout le reste.
2. **Retirer l'XP, les niveaux et les quêtes** : ok, ou on garde une forme d'XP « de compte » (visible en multi par exemple) ?
3. **Pas de chrono en solo** : ok, ou un chrono doux (pas d'échec à zéro, juste un bonus) pour garder de la tension ?
4. **Le défi du jour fait gagner des étoiles** : ok, ou il reste à part pour ne pas « farmer » ?
5. **Entre amis en deux choix (Contre / Ensemble)** : ok ?
6. **Le nom des étoiles** : étoiles, ou un habillage plus « voyage » (tampons de passeport sur chaque département) ?

---

## 10. Tester avec des débutants

Avant l'étape 3, faire jouer 2 ou 3 débutants (dont au moins une personne qui « n'aime pas la géo ») sans rien leur expliquer :
- Est-ce qu'ils savent quoi faire en arrivant ? (on observe, on ne guide pas)
- Après 3 séances sur 3 jours : combien de départements savent-ils placer **sans le jeu**, sur une carte vierge ?
- Ont-ils envie d'y revenir le lendemain ? Qu'est-ce qui les a fait revenir ?
- Qu'ont-ils trouvé frustrant ?

Les réponses décident des ajustements avant de retirer l'ancien système.
