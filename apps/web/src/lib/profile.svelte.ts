// Profil de jeu (XP, série, quêtes, étoiles, album, badges) : stocké dans le navigateur,
// fusionné avec le compte quand on est connecté.
import { applyGame, emptyProfile, sanitizeProfile, type GameReport, type Profile, type Rewards } from "@hexa/game";

const KEY = "hexa.profile.v1";
function load(): Profile {
  try { return sanitizeProfile(JSON.parse(localStorage.getItem(KEY) ?? "null")); } catch { return emptyProfile(); }
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

  setTourStart(region: string) {
    this.data = { ...this.data, tourStart: region };
    this.save();
    for (const fn of this.listeners) fn();
  }

  /** Remplace par la version fusionnée du serveur. */
  replace(p: Profile) {
    this.data = p;
    this.save();
  }
}
export const profile = new ProfileStore();
