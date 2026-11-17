# Feuille de route

Idées validées avec Léo, à planifier. Mise à jour : 2026-11-17.

## Fait
- **v1.12** : pause en partie solo (la question est cachée, le temps ne compte pas, pause automatique si l'appli passe en arrière-plan) ; confirmation avant de quitter une partie, le défi du jour ou une partie entre amis ; couleurs de correction : vert = juste, rose = faux, jaune réservé à la question (le bleu reste la couleur d'Hexa) ; légende de la carte à la correction ; sous-préfectures et voisins corrigés un par un (justes, faux, ce qui manquait).
- **v1.10 / v1.11** : statistiques anonymes lisibles dans Grafana ; invités au classement du défi sous un pseudo généré, repris par leur compte à l'inscription ; confirmation du pseudo après inscription via Google & co.
- **v1.9** : référencement : 127 pages générées (101 départements, 18 régions, listes, carte, quiz) sous `/france` et `/quiz`, données structurées, plan du site par atlas, vraies 404, aperçus de partage. Voir [`seo.md`](seo.md).
- **v1.8** : mise à jour sans coupure (deux versions en ligne, l'ancienne finit ses parties) ; jeu jouable hors ligne (séances, Entraînement) avec reprise automatique au retour du serveur ; copie de secours Cloudflare préparée.
- **v1.7** (étape 5 de la [refonte](conception.md), refonte terminée) : séances expert région par région (sous-préfectures et voisins) et médailles d'or ; Hall of Fame (défi de la semaine et du mois par niveau, Marathon, Légendes).
- **v1.6** (étape 4 de la [refonte](conception.md)) : défi du jour par niveau (Découverte, Confirmé, Expert) avec les mêmes 10 départements, classement et partage par niveau ; Entre amis : chacun joue à son niveau par défaut (3 niveaux), jamais deux inconnues en Découverte.
- **v1.5.1** (retours de Léo sur la v1.5) : séances adaptatives (une question par nouveau département, rappel seulement si raté), une séance = un thème annoncé (région ou révisions), plus de carte surlignée en séance, route d'Hexa en deux échelles (tronçons et grands voyages, communs à tous les atlas), objectif du jour en hexagones chiffrés, accueil et pages secondaires sur un même cadre (ordinateur plein écran, colonnes alignées), page À propos à la place du pied de page, Album et Atlas fusionnés (Médailles, Carte, Succès), anciens écrans Révisions / Éclair / Région retirés.
- **v1.0** : solo (révisions, éclair, région, marathon), défi du jour, multi temps réel (duel, soirée plateau), comptes, RGPD.
- **v1.1** : refonte gamifiée (mascotte, boutons tactiles), XP et niveaux, série, quêtes du jour, Tour de France à étoiles, album, badges, duel à points de vie, réactions.
- **v1.1.1** : plaques à trois paliers (bronze au QCM, argent au clavier, or en expert), carte qui s'entretient (un département pas revu pâlit et ne compte plus qu'à moitié), voisins tapés au clavier en expert (nom ou numéro).

- **v1.5** (étape 3 de la [refonte](conception.md)) : bouton Continuer (séance de 2 minutes composée par le jeu), premier lancement « Tu viens d'où ? », nouveaux départements à deviner (« Nouveau · devine ! ») et « Chez toi » en premier, kilomètres à la place de l'XP (la route d'Hexa : tronçons courts et grands voyages), séances à thème unique annoncé, objectif perso facultatif ; Tour de France, quêtes et niveaux d'XP retirés.
- **v1.4** (étape 2 de la [refonte](conception.md)) : étoiles par département (le placer, son numéro, sa préfecture, gagnées sans aide), médailles bronze / argent / or qui mesurent le savoir, « Ta France » sur 303 étoiles, niveaux Découverte / Confirmé / Expert, reprise des anciens profils sans perte.
- **v1.3** (étape 1 de la [refonte](conception.md)) : nouvel Entraînement configurable (raccourcis, on te donne / on te demande, zone, longueur), sans chrono, propositions ou clavier changeable en pleine partie, placement en propositions parmi 4 départements surlignés. Avant : connexion Google, appli installable et notifications, incitation à créer un compte, écran de jeu mobile sans défilement, correction lisible, rappel « place-le sur la carte ».
- **v1.2** : handicap par joueur en salon (points normalisés sur le pourcentage), mode « En équipe » (3 vies communes, étoiles d'équipe), mobile : une question à la fois en 4 propositions et chrono fixé en haut.

## Chantiers de game design ✅ (refonte terminée le 2026-11-17, v1.3 à v1.7)

Constat de Léo (2026-11-16) : « c'est bien, mais pas assez intuitif et ça part dans tous les sens ». Les fonctionnalités se sont empilées au fil des idées (Tour, entraînement, révisions, vignettes, badges, quêtes, niveaux, rangs, série, défi, salons…) sans vision d'ensemble. Avant d'ajouter quoi que ce soit, deux chantiers de conception, à mener sur papier (puis maquette) :

➡️ Proposition en cours de validation : [`conception.md`](conception.md) (chantiers 1 et 2 traités ensemble).
Embarqué dans cette refonte (retour testeur du 2026-11-16) : **entraînement configurable** (choisir ce qu'on te donne et ce qu'on te demande) et **plus jamais deux inconnues dans une question** (« place le 87 » est impossible pour un débutant). Livré avec l'Entraînement, étape 1.

### 1. Le système de progression ✅
**Fait** : étoiles par département, « Ta France », médailles bronze / argent / or, kilomètres et grands voyages, série seule (voir [`conception.md`](conception.md)).

- **Problème** : trop de compteurs parallèles qui mesurent des choses voisines (XP et niveaux, rangs par maîtrise, étoiles du Tour, vignettes bronze/argent/or, % de « Ta France », badges, série). Le joueur ne sait pas lequel compte ni ce qu'il doit faire ensuite.
- **À définir** : une boucle unique et lisible (« je joue → j'apprends → ça se voit → je débloque »), un seul indicateur principal de maîtrise, le rôle exact de chaque récompense (ce qu'elle mesure, ce qu'elle débloque), ce qu'on supprime ou fusionne.
- **Livrable** : une page de règles de progression (une phrase par système), puis l'interface qui en découle.

### 2. Les mécaniques et les modes de jeu ✅
**Fait** : Continuer (séances composées), Défi du jour par niveau, Entre amis, Entraînement configurable ; « Tu viens d'où ? » au premier lancement.

- **Problème** : beaucoup de portes d'entrée (Tour, révisions, éclair, région, marathon, défi, duel, équipe, soirée, battle royale) et des règles différentes selon les modes (indice, champs demandés, chrono, notation). Un nouveau joueur ne sait pas par où commencer.
- **À définir** : le parcours du nouveau joueur (première minute, première séance, premier retour le lendemain), le nombre de modes vraiment utiles et leur promesse en une phrase, des règles communes (un tour se joue toujours de la même façon), ce qui relève du solo, du multi, du défi.
- **Livrable** : une carte des modes, la règle d'un tour, le parcours du nouveau joueur ; tests avec des débutants (dont la copine de Léo !) avant de recoder.

### 3. Déployer sans couper les parties ✅ (2026-11-17)
**Fait** : deux versions en ligne (bleue / verte) derrière un aiguilleur ; la nouvelle prend les nouveaux joueurs, l'ancienne finit ses parties puis s'arrête seule (voir `deploy/README.md`). Et le palier 0 de résilience : jeu jouable hors ligne (copie dans le navigateur) et copie de secours Cloudflare prête (`deploy/secours/`, à activer par Léo).

- **Problème** : une mise à jour redémarre le serveur, ce qui coupe les salons en cours (duels, équipes, battle royale) ; aujourd'hui le script de déploiement refuse simplement de redémarrer s'il y a des joueurs, ce qui bloque les mises à jour pendant les soirées.
- **Pistes** : un mode « vidange » (le serveur n'ouvre plus de nouveaux salons, prévient les joueurs, attend la fin des parties puis redémarre de lui-même) ; ou deux instances en relais derrière le proxy (la nouvelle prend les nouveaux salons pendant que l'ancienne finit les siens) ; ou la sauvegarde de l'état des salons pour reprendre la partie après redémarrage (les clients se reconnectent déjà automatiquement).
- **Livrable** : une mise à jour possible à tout moment, sans partie coupée, avec un message clair aux joueurs (« nouvelle version dans 2 minutes »).

## Prochaines versions

### Progression
- **Récompenses cosmétiques** liées aux médailles, à « Ta France » et aux kilomètres parcourus (ex-XP) : accessoires pour la mascotte, thèmes de carte. Visibles par les autres joueurs en multi.
- **Ligues hebdomadaires** : groupes d'une trentaine de joueurs classés sur les **kilomètres de la semaine**, montée et descente chaque semaine. À lancer quand il y aura assez de joueurs.
- **Page « Nouveautés »** (notes de version) accessible depuis l'accueil.

### Les atlas (décidé avec Léo le 2026-11-16)
Hexa reste un jeu sur la France, mais d'autres cartes pourront s'ajouter sous forme d'**atlas**. Un atlas = **une carte + une liste de choses à apprendre + des facettes** (ce qu'on apprend sur chaque chose), et tout y fonctionne pareil : Continuer, Défi, Entre amis, Entraînement, étoiles, médailles bronze / argent / or.

**Les règles**
1. **L'atlas France ne grossit jamais.** Son contenu est figé : le placer, le numéro, la préfecture ; en expert les sous-préfectures et les voisins (or). Tout nouveau contenu est soit un **autre atlas**, soit de la **lecture** (fiches, « Le savais-tu ? » à la correction), soit rien.
2. **Une liste plate, sans sous-atlas.** France, Régions de France, Europe… sont tous au même niveau. Pas d'« Europe › Régions › Gentilés ».
3. **Les facettes d'un atlas sont fixées dès sa création**, base et expert compris, et ne bougent plus ensuite.
4. **Peu d'atlas au total** (une demi-douzaine au plus). Un atlas n'entre que s'il tient en une phrase, intéresse assez de joueurs et repose sur des données propres.
5. **Rien n'est verrouillé.** Tous les atlas sont accessibles dès le premier jour depuis « Autres atlas » dans le profil. On ne les met simplement pas en avant au début : l'accueil d'un nouveau joueur ne montre que la France ; après sa première région en bronze, la mascotte présente les autres atlas une fois, puis un sélecteur apparaît sur l'accueil.
6. **Chaque atlas progresse indépendamment** (ses étoiles, ses médailles, son pourcentage). Ne pas jouer à un atlas ne coûte rien ailleurs, aucun atlas n'en débloque un autre.
7. **La série, les kilomètres et le grand voyage sont communs** : une partie dans n'importe quel atlas garde la flamme et fait avancer Hexa sur la même route (une seule barre de kilomètres pour tout le jeu) ; le défi du jour reste celui de la France (un défi par atlas : à voir plus tard).
8. **Hexa qui voyage** plutôt que de nouvelles mascottes : la même mascotte avec une tenue par atlas (béret, casque viking, chapeau de paille…). L'app garde le nom Hexa et la France reste l'atlas principal, ouvert par défaut.

**Les atlas envisagés, dans l'ordre**

| # | Atlas | Promesse | Base / expert | Taille |
|---|---|---|---|---|
| 1 | **France** (principal) | « Les 101 départements par cœur » | carte, numéro, préfecture / sous-préfectures, voisins | 101 |
| 2 | **Régions de France** | « Les régions, leur capitale, ce qu'elles contiennent » | carte, chef-lieu / départements qui la composent | 18 |
| 3 | **Europe** | « Tous les pays d'Europe » | carte, capitale, drapeau / voisins, nationalité | ≈ 45 |
| 4 | **Gentilés de France** | « Comment s'appellent les habitants ? » | régions (Bretons…) puis départements / préfectures (Quimpérois…) | ≈ 220 |
| 5 | **Monde** | « Tous les pays du monde » | carte, capitale, drapeau / continent, voisins | ≈ 195 |
| (6) | **Fleuves et montagnes** *(possible)* | « D'où viennent les noms des départements » | le fleuve ou le massif qui donne son nom au département, et où il est | à définir |

- **Pourquoi cet ordre** : Régions est petit, finissable en quelques jours, ses données sont déjà dans le COG de l'INSEE : idéal pour roder le système d'atlas. L'Europe intéresse beaucoup plus de monde que les gentilés. Le Monde est le plus gros chantier de données et le plus concurrencé. Fleuves et montagnes demande une interaction nouvelle (désigner un fleuve), à concevoir.
- **Gentilés : France uniquement.** En Europe et dans le Monde, l'équivalent est la nationalité, déjà dans l'expert. Les habitants des villes étrangères (Berlinois…) : non, trop niche et données douteuses. Les données des gentilés français sont à sourcer et vérifier (absentes du COG).
- **Ce qui ne devient pas un atlas** : l'origine des noms et les anecdotes (pourquoi 2A / 2B, pourquoi pas de 20) vont dans les fiches et le « Le savais-tu ? » ; les régions des pays étrangers (Länder, provinces…) ne se feraient que sur vraie demande des joueurs.
- **Quand** : après la refonte (étapes 1 à 5 de la conception), une fois la France solide et quand des joueurs arrivent au bout.
- **Points de vigilance** : ne pas retomber dans « ça part dans tous les sens », ne pas diluer l'identité France, le travail de données (cartes propres, territoires contestés, micro-États, drapeaux qui changent).

### Plus tard
- Application mobile Flutter (v2), branchée sur la même API et le même protocole WebSocket (`packages/game/src/protocol.ts`).
