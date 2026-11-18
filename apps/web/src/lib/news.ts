// Page « Nouveautés » : ce qui change pour les joueurs, dans leurs mots (pas le détail technique).
// La plus récente en premier. `id` croissant : le point rose du menu s'allume tant que la dernière n'a pas été vue.
export interface News { id: number; version: string; date: string; title: string; items: string[] }

export const NEWS: News[] = [
  {
    id: 14, version: "1.16", date: "2026-11-18", title: "Nouveau : les régions",
    items: [
      "Un deuxième atlas : les 18 régions, leur chef-lieu, puis en expert leurs départements et leurs voisines.",
      "Choisis ce que tu apprends en haut de l'accueil : tout suit (Continuer, la carte, l'Album, l'Entraînement, le défi du jour).",
      "Chaque atlas a son défi du jour, son classement et son Hall of Fame. Entre amis, l'hôte choisit l'atlas, et chacun joue à son niveau.",
      "Ta série et les kilomètres d'Hexa restent communs. Et dans les régions, Hexa sort son bob d'explorateur.",
    ],
  },
  {
    id: 13, version: "1.15.1", date: "2026-11-18", title: "Pas de spoil, et ton pseudo comme tu veux",
    items: [
      "Les réponses d'un ami à son défi du jour ne s'ouvrent qu'une fois que tu as joué le tien : plus moyen de se gâcher le défi (ni de tricher) en regardant avant.",
      "Après une inscription avec Google (ou un autre service), tu peux maintenant effacer complètement le prénom proposé pour taper ton pseudo.",
      "Le partage marche partout, Snapchat compris (il restait sur un écran noir) : un seul bouton, ton score et ton lien, et l'image de ton résultat s'affiche dans l'aperçu du lien.",
    ],
  },
  {
    id: 12, version: "1.15", date: "2026-11-17", title: "Montre tes réponses (ou cache-les)",
    items: [
      "Partager ton défi du jour donne un lien vers ta page de résultat : ton score, ta grille, et toutes tes réponses, question par question (idée de Mathis).",
      "Pour ne rien gâcher, tes amis voient d'abord ton score : les réponses sont repliées tant que le défi du jour est en cours.",
      "Le partage parle à tout le monde : ✅ juste, 🟧 à moitié, ❌ raté, avec le décompte en toutes lettres. Et l'image affiche ✓, ~ et ✗ dans les cases.",
    ],
  },
  {
    id: 11, version: "1.14.2", date: "2026-11-17", title: "Rejouer sans tout reconfigurer, correction en bleu",
    items: [
      "Après « Rejouer les ratés », le bouton « Nouvelle partie » relance ton entraînement complet, et plus la dernière série de ratés (merci Mathis !).",
      "« Changer les réglages » ramène directement aux réglages de l'Entraînement depuis le bilan.",
      "Correction : la bonne réponse que tu n'as pas trouvée s'affiche en bleu, pour ne plus la confondre avec le vert de « tu as bon ».",
    ],
  },
  {
    id: 9, version: "1.14", date: "2026-11-17", title: "Les kilomètres à chaque réponse",
    items: [
      "En solo, chaque réponse affiche les kilomètres qu'elle fait gagner à Hexa (combo compris).",
      "Défi du jour : partage ton résultat en image, prête à poster.",
      "Cette page, pour suivre ce qui change.",
    ],
  },
  {
    id: 8, version: "1.13", date: "2026-11-17", title: "Ton compte, sans insister",
    items: [
      "Hexa te propose de sauvegarder ta progression aux moments qui comptent (une médaille, une série…), et plus rarement ensuite.",
      "Pas envie d'un compte ? Après deux refus, « Ne plus me proposer » arrête les demandes.",
    ],
  },
  {
    id: 7, version: "1.12", date: "2026-11-17", title: "Pause, et des corrections plus claires",
    items: [
      "Bouton pause pendant les parties solo (ou touche Échap). La question est cachée pendant la pause.",
      "On te demande confirmation avant de quitter une partie, le défi du jour ou une partie entre amis.",
      "Correction : vert = juste, rose = faux, avec une légende sur la carte.",
      "Sous-préfectures et voisins corrigés un par un : ce qui est juste, ce qui est faux, ce qui manquait.",
    ],
  },
  {
    id: 6, version: "1.11", date: "2026-11-17", title: "Les invités au classement",
    items: [
      "Sans compte, ton défi du jour est classé sous un pseudo tiré au sort (« Dauphin du Morbihan »).",
      "En créant ton compte, tes scores d'invité passent sous ton vrai pseudo.",
      "Inscription avec Google : tu choisis ton pseudo au lieu de garder ton prénom.",
    ],
  },
  {
    id: 5, version: "1.9", date: "2026-11-17", title: "Plus fiable",
    items: [
      "L'appli se met à jour toute seule, plus besoin de la relancer.",
      "Le bilan de fin de séance s'ouvre à tous les coups (merci Mr Fragul !).",
      "Val-d'Oise : Cergy et Cergy-Pontoise sont acceptés comme préfecture.",
      "Une fiche pour chaque département et chaque région sur hexapop.app/france.",
    ],
  },
  {
    id: 4, version: "1.8", date: "2026-11-17", title: "Jouable hors ligne",
    items: [
      "Séances et Entraînement marchent sans connexion ; ta progression part au retour du réseau.",
      "Les mises à jour ne coupent plus les parties en cours.",
    ],
  },
  {
    id: 3, version: "1.7", date: "2026-11-17", title: "L'or et le Hall of Fame",
    items: [
      "Quand une région est connue, l'expert s'ouvre : sous-préfectures et voisins, pour la médaille d'or.",
      "Hall of Fame : meilleurs scores du défi (semaine, mois), Marathon, et les Légendes.",
    ],
  },
  {
    id: 2, version: "1.6", date: "2026-11-17", title: "Le défi du jour à ton niveau",
    items: [
      "Découverte, Confirmé ou Expert : les mêmes 10 départements, les questions de ton niveau, un classement par niveau.",
      "Entre amis, chacun joue à son niveau : un débutant peut battre un expert.",
    ],
  },
  {
    id: 1, version: "1.5", date: "2026-11-17", title: "Le nouvel Hexa",
    items: [
      "Un gros bouton Continuer : une séance courte, sur un thème annoncé.",
      "Ta carte de France se colore : 3 étoiles par département, puis bronze, argent et or.",
      "Hexa fait le tour de France avec tes kilomètres.",
      "Un Entraînement où tu choisis tout : la zone, ce qu'on te donne, ce qu'on te demande.",
    ],
  },
];

const SEEN = "hexa.news.seen";
export const latestNews = NEWS[0].id;
export function newsSeen(): number { try { return Number(localStorage.getItem(SEEN) ?? 0); } catch { return latestNews; } }
export function markNewsSeen() { try { localStorage.setItem(SEEN, String(latestNews)); } catch { /* rien */ } }
