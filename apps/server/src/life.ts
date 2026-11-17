// Cycle de vie d'une instance (déploiement à deux versions, voir router.ts et deploy/deploy.sh).
// L'instance « active » reçoit les nouveaux joueurs. Après une mise à jour, l'ancienne passe « en vidange » :
// elle finit ses parties en cours, ne crée plus de salon, n'envoie plus de notifications, puis s'arrête seule.
export const life = {
  /** Couleur de l'instance (blue ou green) ; vide hors déploiement à deux versions. */
  color: process.env.COLOR ?? "",
  draining: false,
  /** Jeton partagé avec l'aiguilleur pour les routes /api/internal (désactivées sans jeton). */
  internalToken: process.env.INTERNAL_TOKEN ?? "",
};
