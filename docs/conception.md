# Hexa · Conception du jeu (refonte des modes et de la progression)

Document de travail. **Version 2 du 2026-11-16, toutes les décisions tranchées** (intègre les retours de jeu de Léo et des testeurs, voir section 11).
Version courte pour les testeurs : [`ce-qui-change.md`](ce-qui-change.md).
Il couvre les chantiers 1 (progression) et 2 (modes et mécaniques) de la [feuille de route](roadmap.md) : ils se conçoivent ensemble, parce que chaque mode nourrit la progression et que la progression décide de ce qu'on joue ensuite.

---

## 0. Ce qu'on vise

> **Partir de zéro et finir par connaître les 101 départements par cœur, sans jamais se demander « je fais quoi, là ? ».**

Cinq principes, qui servent d'arbitre pour toutes les décisions qui suivent :

1. **Jamais deux inconnues dans une question.** On te donne toujours quelque chose que tu peux connaître.
2. **Le jeu choisit pour toi** ce que tu joues en solo (quoi réviser, quoi découvrir). Les seuls réglages sont des préférences de confort (clavier ou propositions), changeables à tout moment.
3. **Un seul indicateur de progrès**, visible partout : ta carte de France qui se remplit.
4. **Chaque récompense mesure un vrai savoir.** Pas de compteur qui monte juste parce qu'on a joué.
5. **Le jeu s'adapte au niveau du joueur**, y compris le défi du jour : un amateur ne doit jamais se sentir écrasé.

---

## 1. État des lieux

### Ce qui marche (à garder)
- La **carte** comme cœur du jeu, la DA (mascotte, boutons bonbon, riso), le ressenti tactile.
- La **fiche complète** (placer + numéro + préfecture d'un coup) et le **« semi-bon »** : on est récompensé pour ce qu'on sait, même partiellement. Les joueurs aiment.
- Le choix **clavier ou propositions** : parfois on a juste la flemme de taper.
- Le **défi du jour** (rituel, partage, classement) et la **série**.
- La **répétition espacée** et l'idée que **la carte s'efface** si on ne révise pas.
- Le **multi en direct** : duel à points de vie, **soirée** jusqu'à 100 (très appréciée), équipe, handicap.

### Ce qui coince

**Trop de portes.** Accueil : Jouer, Défi du jour, Entre amis, Quêtes, puis Tour de France, Entraînement, Album, Atlas, Rappels. Dans Entraînement : Révisions, Éclair, Une région, Marathon. Un nouveau joueur ne sait pas par où commencer, un joueur régulier ne sait pas ce qui le fait le plus progresser.

**C'est dur pour un amateur**, surtout le défi du jour (retour global des testeurs). Trois causes :
- des questions à **deux inconnues** (« place le 87 » : il faut savoir quel département porte le 87 *et* où il est) ;
- la **fiche complète d'entrée de jeu**, sur des départements jamais vus ;
- un **défi unique** pour tout le monde, calibré pour quelqu'un qui connaît déjà.

**Le réglage normal / expert** est une décision qu'un débutant ne sait pas prendre, et l'expert arrive comme un mur.

**Huit compteurs qui se marchent dessus.**

| Compteur | Ce qu'il mesure vraiment | Problème |
|---|---|---|
| XP et niveaux | combien on joue | utile, mais les niveaux 1, 2, 3… font croire à un niveau de connaissance |
| Quêtes du jour (3) | des objectifs variés | doublon avec le défi et la série |
| Étoiles de région (Tour) | la réussite d'une manche | réussir une fois ≠ savoir |
| Vignettes bronze / argent / or | le format de réponse utilisé | mesure le réglage, pas le savoir |
| « Ta France » en % | la répétition espacée | le seul vrai indicateur, mais caché à droite |
| Rangs (Touriste → Géomètre) | idem « Ta France » | doublon |
| Badges | des exploits | OK en secondaire |
| Série | l'habitude | OK |

Trois d'entre eux (étoiles, vignettes, « Ta France ») prétendent dire « tu connais ce département », et ne sont pas d'accord entre eux.

---

## 2. Ce qu'il y a à apprendre

On découpe le savoir en **facettes**. Un département, c'est :

| Facette | Exemple | Niveau |
|---|---|---|
| **Carte** | où est le Finistère | base |
| **Numéro** | le Finistère, c'est le 29 | base |
| **Préfecture** | la préfecture du Finistère, c'est Quimper | base |
| Sous-préfectures | Brest, Châteaulin, Morlaix | expert |
| Voisins | Côtes-d'Armor, Morbihan | expert |

Soit **101 × 3 = 303 facettes de base**, puis 202 facettes expert. Cette liste est **figée** : les futurs contenus (régions et chefs-lieux, gentilés, Europe…) seront d'**autres atlas**, chacun avec sa propre carte et sa propre progression, et jamais de nouvelles facettes de la France (voir « Les atlas » dans la [feuille de route](roadmap.md)).

**Jamais deux inconnues.** Une question donne un **indice** que le joueur peut connaître, et chaque champ demandé ne dépend que de cet indice. L'indice est le **nom** ou le **département qui clignote sur la carte** ; le **numéro** ou la **préfecture** ne servent d'indice que si le joueur les connaît déjà pour ce département (facette déjà gagnée). Ainsi « place le 87 » n'arrive qu'à quelqu'un qui sait que le 87 est la Haute-Vienne.

---

## 3. La règle d'un tour

> **On te donne un indice, tu remplis ce qu'on te demande, correction tout de suite.**

### 3.1 Deux formats, qui se suivent naturellement
- **Question simple** : une seule chose à trouver (« Où est le Finistère ? »). Pour **découvrir** un département et pour les facettes encore fragiles.
- **Fiche complète** : plusieurs choses à la fois (placer + numéro + préfecture), avec **le semi-bon** (2 sur 3, c'est 2 facettes qui progressent). Pour **consolider** : elle arrive dès que chaque facette du département a été vue au moins une fois.

Concrètement : on découvre le Finistère en questions simples, puis il revient en fiche complète. Le joueur passe de l'un à l'autre sans le choisir, et la fiche complète devient le signe qu'on progresse.

### 3.2 La forme de la réponse : préférence du joueur
- **Propositions ou clavier**, au choix, **changeable à tout moment** (un bouton dans la question, mémorisé).
- Pour la carte, les « propositions » sont **4 départements surlignés**, en Entraînement seulement (France entière, leurres voisins). **Pas en séance** : on y joue région par région, des leurres pris ailleurs trahiraient la réponse (retour de Léo, 2026-11-17). Pendant qu'on place, les départements déjà joués dans la partie ne sont plus colorés, pour qu'on ne trouve pas par élimination.
- Les deux formats font progresser. Pour que les propositions restent un vrai test, **elles deviennent plus piégeuses à mesure qu'on progresse** : au début, 4 réponses très différentes ; ensuite, 4 départements de la même région, des numéros proches, des préfectures voisines.

### 3.3 Première rencontre
Un département jamais vu est **deviné, pas montré** : « Nouveau · devine ! », **une seule question complète** (le placer, son numéro, sa préfecture), rien n'est montré avant. Si tu sais, c'est fini : 3 étoiles d'un coup, il ne revient pas dans la séance. Sinon, pas de rouge (« Maintenant tu sais »), la correction t'apprend, et il revient **une fois** en fin de séance (rappel), qui donne les étoiles. Le département d'où vient le joueur est demandé en premier (« Chez toi »). Les révisions et la consolidation sont marquées « À revoir ».

**Une séance = un seul thème, celui qui est annoncé** (retour de Léo, 2026-11-17 : « si l'auto m'annonce Bretagne, je m'attends à n'avoir que la Bretagne »). Soit une **séance de région** (uniquement des départements de cette région : ses révisions, la suite, la découverte, la consolidation), soit une **séance de révisions** (« Révisions · 6 départements à revoir, partout en France »). Une région choisie sur la carte est toujours respectée ; les révisions d'ailleurs sont alors proposées à part (« Plutôt réviser 4 départements ailleurs »). Sans choix, dès 3 révisions dues hors de la région en cours, Continuer propose d'abord la séance de révisions, et l'accueil l'annonce.

*2026-11-17 : la première version montrait chaque facette avant de la demander (carte « À retenir »). Retour de Léo sur un compte neuf : « super long et bateau, on nous donne la réponse et on nous demande juste après ». Remplacée par « devine d'abord », puis rendue adaptative (« on me demande beaucoup la même chose alors que je suis fort ») : une question par nouveau département, rappel seulement en cas d'erreur.*

### 3.4 Correction et chrono
- **Correction immédiate** : la fiche de correction actuelle (✓ / ✗ par champ, bonne réponse, carte).
- **Pas de chrono en solo.** Le chrono et le bonus de vitesse restent au défi du jour et entre amis.

---

## 4. La progression

### 4.1 Un seul indicateur : ta carte de France
Chaque facette de base gagnée allume **une étoile** sur son département. Un département a donc **0 à 3 étoiles** (carte, numéro, préfecture), puis une **médaille** (4.3), et la carte se colore en conséquence. **« Ta France » = étoiles gagnées / 303**, affiché en grand sur l'accueil et à la fin de chaque séance.

- **Gagner une étoile** : réussir la facette au clavier, à la carte entière, ou en propositions piégeuses.
- **L'étoile s'entretient** : la répétition espacée planifie sa révision ; si on la laisse passer, elle **pâlit** et revient en priorité à la séance suivante.

### 4.2 Les médailles : bronze, argent, or
On garde la collection bronze / argent / or que les joueurs aiment, mais elle mesure maintenant **à quel point tu connais chaque département**, et plus la façon dont tu as répondu (avant : propositions = bronze, clavier = argent, expert = or ; quelqu'un qui préférait les propositions ne pouvait jamais dépasser le bronze).

| Médaille | Comment on l'obtient | Ce que ça veut dire |
|---|---|---|
| **Bronze** | les 3 étoiles du département | tu le connais |
| **Argent** | ces 3 étoiles réussies encore plusieurs fois, à des jours d'écart (répétition espacée) | tu l'as retenu pour de bon |
| **Or** | les facettes expert du département (sous-préfectures, voisins) | tu le connais sur le bout des doigts |

- **Un seul système** : les étoiles d'un département débloquent sa médaille ; rien de parallèle.
- **La carte de France prend les couleurs des médailles** : blanc, puis de plus en plus coloré selon les étoiles, puis bronze, argent, or.
- **Un objectif après 100 %** : tout en argent, puis tout en or. L'Album reste la vitrine de la collection, fusionné avec l'Atlas (chaque département : ses étoiles, sa médaille, sa fiche).
- Une médaille ne se perd pas, mais si ses étoiles pâlissent, elle est **ternie** sur la carte jusqu'à la prochaine révision réussie.

### 4.3 Les niveaux du joueur
Trois niveaux, qui découlent de « Ta France » (pas des kilomètres) et décident de la difficulté du défi du jour et des propositions :

| Niveau | Atteint à | Ce que ça change |
|---|---|---|
| **Découverte** | dès le début | indices nom et carte uniquement, propositions faciles |
| **Confirmé** | 50 % de « Ta France » | tous les indices, propositions piégeuses |
| **Expert** | 90 % | facettes expert dans le défi, sous-préfectures et voisins |

Le joueur peut **redescendre d'un niveau** pour le défi s'il le veut (« Défi Découverte » même en étant Confirmé), jamais monter au-dessus du sien. Les titres actuels (Touriste, Routard, Facteur, Sous-préfet, Préfet, Géomètre de l'IGN) restent comme habillage plus fin du pourcentage.

### 4.4 L'expert devient un contenu, pas un réglage
Quand une région a toutes ses étoiles de base, ses facettes expert (sous-préfectures, voisins) s'ouvrent. Un département maîtrisé en expert passe en **or**. On continue de progresser après 100 %, sans jamais avoir eu à cocher « expert ».

### 4.5 Le rendez-vous quotidien
**La série : une séance par jour suffit, toujours.** Une séance de Continuer (≈ 2 min), une partie d'Entraînement, le défi du jour ou une partie entre amis : n'importe laquelle garde la flamme allumée. La barre ne bouge jamais, et le joker de la semaine rattrape un jour oublié.

Les **3 quêtes** sont retirées. À la place, un **objectif personnel facultatif**, que le joueur fixe lui-même s'il en a envie (par exemple 3 séances par jour) : l'atteindre fait passer la flamme du jour en doré, le manquer **ne coûte rien**. Il n'a aucun effet sur la série.

Les raisons de revenir : la flamme à ne pas casser, les étoiles qui pâlissent (notification), le défi du jour, les amis.

### 4.6 Le Hall of Fame
Pour les comptes connectés, trois tableaux :
- **Défi du jour** : classements de la semaine et du mois, **par niveau** (Découverte, Confirmé, Expert).
- **Marathon** : meilleur score sur les 101 en fiche complète (justesse d'abord, temps ensuite).
- **Légendes** : les joueurs qui ont atteint 100 % de « Ta France », puis tout en argent, puis tout en or, avec la date.

### 4.7 Ce qui reste à côté
- **Les kilomètres** (ex-XP) : ils montrent **combien tu joues**, quand la carte montre **ce que tu sais**. Chaque bonne réponse fait avancer Hexa sur la route, dans tous les modes et tous les atlas (défi et multi compris). Affichés comme une **barre d'expérience à deux échelles**, commune à tous les atlas :
  - **la route** : Hexa roule d'une escale à la suivante (« Lyon · encore 164 km · Marseille »), tronçons de 200 à 3 100 km, ça bouge à chaque séance ; à l'écran de fin, la mascotte avance sous tes yeux (« Hexa est arrivé à Marseille ! ») ;
  - **le grand voyage** : l'horizon, avec un segment par tronçon. Le tour de France (3 795 km, par la route, de ville en ville), puis les Antilles et la Guyane (9 800 km), l'océan Indien (14 215 km, jusqu'à La Réunion et Mayotte), le tour du monde (41 995 km, par Nouméa, Wallis, Papeete et Saint-Pierre). Hors de France, distances à vol d'oiseau calculées depuis les coordonnées des escales. Un cycle fait 69 805 km (≈ 5 mois pour un joueur assidu), puis « Grand voyage n° 2 ».
  Et à la semaine (« 840 km cette semaine »), ils servent aux **ligues hebdomadaires** et à se comparer entre amis. **Pas de niveaux** (1, 2, 3…) et rien à débloquer : c'est un compteur d'activité, qui continue de monter quand la carte est finie.
- **Les succès** (ex-badges) : des exploits rares, rangés dans le profil, jamais au premier plan.

### 4.8 Ce qu'on retire ou fusionne

| Aujourd'hui | Demain |
|---|---|
| XP | **gardée et renommée kilomètres** : compteur d'activité (combien tu joues), sans niveaux |
| Niveaux 1, 2, 3… | **retirés** (« Ta France » et les 3 niveaux de joueur disent où tu en es) |
| 3 quêtes du jour | **retirées** ; objectif personnel facultatif, sans effet sur la série |
| Étoiles de région du Tour | **remplacées** par les étoiles des départements de la région |
| Vignettes bronze / argent / or et Album | **gardées sous forme de médailles**, qui mesurent le savoir et plus le format de réponse ; l'Album fusionne avec l'Atlas |
| Rangs | **gardés**, calculés à partir de « Ta France » |
| Badges | **gardés** sous le nom de succès |
| Réglage normal / expert | **supprimé** : l'expert s'ouvre région par région |
| Choix clavier / propositions | **gardé**, comme préférence changeable à tout moment |

---

## 5. Les modes

| Porte | Promesse en une phrase |
|---|---|
| **Continuer** (gros bouton de l'accueil) | « Ta séance de 2 minutes : on révise ce qui s'efface et on découvre la suite. » |
| **Défi du jour** | « 10 départements, les mêmes pour tout le monde, à ton niveau. » |
| **Entre amis** | « Duel, soirée ou équipe, en direct. » |
| **Entraînement** | « Choisis exactement ce que tu veux réviser. » |

### Continuer (le parcours)
- Le jeu compose la séance : **d'abord les étoiles qui pâlissent**, puis **2 ou 3 départements nouveaux** de la région en cours (questions simples), puis les départements à consolider (fiches complètes).
- **Région en cours** : au départ, ta région (« Tu viens d'où ? » au premier lancement, facultatif), puis une région voisine, comme le Tour de France actuel. La carte de l'accueil permet de choisir une autre région.
- C'est l'ancien Tour de France + les Révisions, fusionnés.

### Défi du jour
- **Les 10 mêmes départements pour tout le monde**, pour garder la comparaison et le partage.
- **Ce qu'on te demande dépend de ton niveau** : Découverte (indice nom ou carte, propositions faciles), Confirmé (tous les indices, clavier ou propositions piégeuses), Expert (avec sous-préfectures et voisins).
- **Un classement par niveau**, et le partage indique le niveau (« Défi n° 42 · Découverte · 8/10 »).
- **Pas d'étoiles** : le défi reste une compétition. Les erreurs sont quand même notées, pour que ces départements reviennent dans tes séances.

### Entre amis
On garde les trois formats, qui marchent bien :
- **Duel** (à 2) : points de vie, revanche.
- **Soirée** (3 à 100) : classement en direct, option battle royale, écran à projeter.
- **Équipe** : vies communes.

Le **handicap** se règle par défaut sur le niveau de chaque joueur (modifiable), et le score est normalisé : un Découverte peut battre un Expert.

### Entraînement
On garde l'Entraînement, et il devient **beaucoup plus précis** : un seul écran qui remplace les 4 cases actuelles (Révisions, Éclair, Une région, Marathon). C'est là qu'on choisit exactement sur quoi s'entraîner, alors que Continuer choisit pour toi :
- **Zone** : France, une région, outre-mer.
- **Ce qu'on te donne** : le nom, le département qui clignote sur la carte, le numéro, la préfecture (un ou plusieurs).
- **Ce qu'on te demande** : le placer, le nom, le numéro, la préfecture, et en expert sous-préfectures et voisins. Un seul coché = questions simples ; plusieurs = fiche complète.
- **Longueur** : 10, 20, les 101 (le **Marathon**, qui alimente le Hall of Fame).

Exemples : un débutant coche « on me donne le nom » + « je le place » pour apprendre la carte seule ; un joueur qui révise ses numéros coche « on me donne la carte » + « je donne le numéro ». Ici les combinaisons à deux inconnues restent possibles, puisque c'est le joueur qui les choisit. L'Entraînement fait gagner des étoiles comme Continuer.

### Accueil
Le gros bouton **Continuer**, la carte « Ta France » en héros avec le pourcentage et la série, puis le défi et Entre amis. Entraînement, Atlas, Hall of Fame et profil en secondaire.

---

## 6. Le parcours du nouveau joueur

**Première minute**
1. Ouverture : pas de compte, pas de menu. La mascotte : « Tu viens d'où ? » → il touche son département sur la carte (ou « passer »).
2. Première séance tout de suite : son département d'abord (« Chez toi », sûrement su), puis les départements autour à deviner, un rappel en fin de séance pour ceux ratés. De 4 à 8 questions selon ce qu'il sait déjà.
3. Fin de séance : « 4 étoiles ! Ta France : 1 % », sa région commence à se colorer, la série démarre.

**Après la première séance** : la proposition de sauvegarder (compte), puis d'activer les rappels (« on te dit quand tes étoiles pâlissent »).

**Le lendemain** : notification « 3 étoiles pâlissent + le défi n° 42 est arrivé ». Continuer → révisions d'abord, puis la suite ; son premier défi est en Découverte, à sa portée.

**La première semaine** : 2 à 3 régions, les premières fiches complètes, une série de 7 jours, le premier défi partagé, le premier duel.

---

## 7. Ce que deviennent les données existantes

Personne ne doit perdre ce qu'il a gagné :
- **Répétition espacée existante** (boîte par département) → chaque facette de base hérite de la boîte de son département ; boîte ≥ 4 = étoile.
- **Vignettes** : argent ou or → 3 étoiles, donc médaille de bronze (le joueur la refait monter en jouant) ; bronze → facettes « vues ».
- **Étoiles de région** → la région en cours et les régions ouvertes sont conservées.
- **Badges** → succès, à l'identique.
- **XP** → convertie en kilomètres (1 XP = 1 km), rien n'est perdu. Le niveau d'XP n'est plus affiché.
- **Série, défis joués** → conservés.

---

## 8. Livraison par étapes

1. **Entraînement** avec les réglages « on te donne / on te demande », les deux formats (question simple, fiche complète), propositions ou clavier changeable en cours de partie, carte à 4 départements surlignés. À côté de l'existant : on teste en vrai sans rien casser. *(Répond directement au retour du testeur.)* ✅ **Livré le 2026-11-16** (raccourcis, on te donne / on te demande dont l'indice préfecture, zone, longueur, sans chrono, bascule propositions / clavier, 4 départements surlignés). Pas encore fait : la carte « À retenir » de première rencontre et les propositions de plus en plus piégeuses, qui dépendent des étoiles (étape 2).
2. **Les étoiles par facette, « Ta France » et les 3 niveaux**, avec la migration des profils. ✅ **Livré le 2026-11-16** : étoiles par facette (sans aide = étoile, avec aide = « vue »), médailles bronze / argent / or (ternies si à réviser), « Ta France » sur 303, titres et niveau Découverte / Confirmé / Expert affichés, reprise automatique des anciens profils, Album et fin de partie aux médailles, badges de collection sur les médailles. Les niveaux ne modifient pas encore le défi (étape 4) ; l'XP et ses niveaux restent jusqu'à l'étape 3 (kilomètres).
3. **Continuer** (séance composée automatiquement) + **nouvel accueil** + premier lancement « Tu viens d'où ? » + objectif personnel facultatif. On retire alors le Tour de France (remplacé par Continuer), les quêtes et les niveaux d'XP ; l'XP devient des kilomètres et les vignettes des médailles. ✅ **Livré le 2026-11-17** : séance composée (révisions échues, puis découverte de la région en cours en « devine d'abord » avec propositions faciles, rappel en fin de séance, consolidation), accueil avec Continuer et choix de région sur la carte, « Tu viens d'où ? », kilomètres (total et semaine), objectif perso facultatif, retrait du Tour de France, des quêtes et des niveaux d'XP. Les propositions normales (leurres voisins) font gagner l'étoile ; seules les faciles comptent comme « vu ». Reste à faire : fusion Album / Atlas.
4. **Défi du jour par niveau** (classements séparés) et **Entre amis** à la nouvelle règle, handicap par niveau.
5. **Facettes expert** et médailles d'or, puis **Hall of Fame**.

Chaque étape est jouable et déployable seule.

---

## 9. Décisions

| # | Question | Décision |
|---|---|---|
| 1 | Une seule chose par question ? | **Non : deux formats.** Questions simples pour découvrir, fiche complète (avec semi-bon) pour consolider, et au choix à l'Entraînement. |
| 2 | Retirer l'XP, les niveaux, les quêtes ? | **XP gardée, renommée kilomètres** (combien tu joues, sans niveaux) ; **niveaux 1, 2, 3 et quêtes retirés** ; la série se garde avec une seule séance par jour, objectif personnel facultatif à côté. |
| 3 | Chrono en solo ? | **Retiré.** Reste au défi et entre amis. |
| 4 | Le défi fait gagner des étoiles ? | **Non.** Ses erreurs reviennent quand même en séance. |
| 5 | Entre amis ? | **On garde Duel, Soirée et Équipe.** |
| 6 | Nom des étoiles ? | **Étoiles.** |
| 7 | Clavier ou propositions ? | **Gardé** comme préférence changeable à tout moment ; propositions de plus en plus piégeuses. |
| 8 | Expert trop dur pour les amateurs ? | **3 niveaux de joueur** ; l'expert s'ouvre région par région ; défi du jour à ton niveau. |
| 9 | Retirer bronze / argent / or ? | **Non : gardés en médailles par département**, qui mesurent le savoir (bronze = 3 étoiles, argent = retenu dans la durée, or = expert). |

---

## 10. Tester avec des débutants

Avant l'étape 3, faire jouer 2 ou 3 débutants (dont au moins une personne qui « n'aime pas la géo ») sans rien leur expliquer :
- Est-ce qu'ils savent quoi faire en arrivant ? (on observe, on ne guide pas)
- Après 3 séances sur 3 jours : combien de départements savent-ils placer **sans le jeu**, sur une carte vierge ?
- Ont-ils envie d'y revenir le lendemain ? Qu'est-ce qui les a fait revenir ?
- Le défi Découverte est-il à leur portée ? Qu'ont-ils trouvé frustrant ?

Les réponses décident des ajustements avant de retirer l'ancien système.

---

## 11. Retours de testeurs et de Léo

- **2026-11-16, testeur** : « J'aimerais pouvoir configurer l'entraînement précisément, choisir ce qu'il peut te demander de trouver. Quand le jeu me dit de placer le 87, moi qui ne connais rien, c'est juste impossible, alors que placer un département nommé ou affiché sur la carte, c'est plus simple pour moi. »
  → Règle « jamais deux inconnues » (section 2) et réglages « on te donne / on te demande » de l'Entraînement (section 5). Étape 1.
- **2026-11-16, retour global des testeurs** : « Pour des amateurs, c'est dur, notamment le défi du jour. »
  → 3 niveaux de joueur, défi du jour à ton niveau avec classement par niveau (sections 4.3 et 5). Étapes 2 et 4.
- **2026-11-16, Léo** : aime être interrogé sur toutes les infos (on peut avoir « semi-bon ») ; ne veut pas perdre le choix clavier / propositions (« parfois on a la flemme de taper ») ; tient à la soirée ; demande sur quoi reposerait le Hall of Fame.
  → Deux formats de tour (3.1), préférence de réponse (3.2), trois formats entre amis (5), Hall of Fame (4.6).
- **2026-11-16, Léo** : un objectif du jour à 1, 3 ou 5 séances pour garder sa série, « frustrant ».
  → Une séance par jour suffit toujours pour la série ; l'objectif devient personnel, facultatif et sans effet sur la série (4.5).
- **2026-11-16, Léo** : « On perd le bronze, argent, or, c'est dommage. »
  → Gardés, en médailles par département qui mesurent le savoir et plus le format de réponse (4.2).
- **2026-11-16, testeur** : « J'aurais pas complètement supprimé l'XP : la carte montre ton niveau de connaissance, l'XP montre à quel point tu joues. Une fois les 3 étoiles partout, il n'y a plus aucun indicateur qui montre qu'on joue encore. »
  → XP gardée et renommée **kilomètres**, sans niveaux, base des ligues hebdomadaires (4.7).
