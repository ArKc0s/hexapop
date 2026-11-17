// Profil de jeu (kilomètres, série, étoiles et médailles, badges) : stocké dans le navigateur,
// fusionné avec le compte quand on est connecté.
import { applyGame, emptyProfile, migrateKnowledge, sanitizeProfile, type GameReport, type Profile, type Progress, type Rewards } from "@hexa/game";

const KEY = "hexa.profile.v1";
/** Profils d'avant les étoiles (v1.4) : on reprend la révision et les vignettes, personne ne perd rien. */
function withKnowledge(p: Profile): Profile {
  if (p.know) return p;
  let old: Progress = {};
  try { old = JSON.parse(localStorage.getItem("hexa.progress.v1") ?? "{}"); } catch { /* rien à reprendre */ }
  return { ...p, know: migrateKnowledge(old, p.tiers, Date.now()) };
}
function load(): Profile {
  try { return withKnowledge(sanitizeProfile(JSON.parse(localStorage.getItem(KEY) ?? "null"))); } catch { return withKnowledge(emptyProfile()); }
}

class ProfileStore {
  data = $state<Profile>(load());
  /** Dernières récompenses, affichées par l'écran de fin. */
  lastRewards = $state<Rewards | null>(null);
  private listeners: (() => void)[] = [];
  onChange(fn: () => void) { this.listeners.push(fn); }

  private save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* stockage indisponible */ }
  }

  record(report: GameReport): Rewards {
    // Instantanés : les objets réactifs de Svelte ne passent pas par structuredClone.
    const { profile, rewards } = applyGame($state.snapshot(this.data) as Profile, $state.snapshot(report) as GameReport);
    this.data = profile;
    this.lastRewards = rewards;
    this.save();
    for (const fn of this.listeners) fn();
    return rewards;
  }

  /** « Tu viens d'où ? » (null : passé). */
  setHome(code: string | null) {
    this.data = { ...this.data, home: code ?? undefined };
    this.save();
    for (const fn of this.listeners) fn();
  }

  /** Région choisie sur la carte de l'accueil pour la prochaine séance (null : retour à l'ordre normal). */
  setFocus(region: string | null) {
    this.data = { ...this.data, focus: region ?? undefined, focusAt: Date.now() };
    this.save();
    for (const fn of this.listeners) fn();
  }

  setTourStart(region: string) {
    this.data = { ...this.data, tourStart: region };
    this.save();
    for (const fn of this.listeners) fn();
  }

  /** Remplace par la version fusionnée du serveur. */
  replace(p: Profile) {
    this.data = withKnowledge(p);
    this.save();
  }
}
export const profile = new ProfileStore();
