// Installation sur l'écran d'accueil (appli web) et plein écran pendant les parties.
interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const KEY = "hexa.install.dismissed";

class Install {
  /** Déjà ouvert comme une appli installée (pas de barre de navigateur). */
  standalone = $state(typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true));
  /** iPhone / iPad : pas de bouton d'installation possible, seulement « Partager → Sur l'écran d'accueil ». */
  ios = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  /** Navigateur iPhone autre que Safari (Brave, Chrome, Firefox…) : l'ajout à l'écran d'accueil n'y est pas toujours proposé. */
  iosOther = this.ios && (/crios|fxios|edgios|opt\//i.test(navigator.userAgent) || !!(navigator as { brave?: unknown }).brave);
  mobile = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  dismissed = $state((() => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } })());
  private deferred: InstallPromptEvent | null = null;
  canPrompt = $state(false);
  fullscreen = $state(false);
  /** Le plein écran du navigateur n'existe pas sur iPhone (seulement pour les vidéos). */
  fullscreenAvailable = typeof document !== "undefined" && !!document.fullscreenEnabled;

  constructor() {
    if (typeof window === "undefined") return;
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); this.deferred = e as InstallPromptEvent; this.canPrompt = true; });
    window.addEventListener("appinstalled", () => { this.canPrompt = false; this.dismiss(); });
    document.addEventListener("fullscreenchange", () => (this.fullscreen = !!document.fullscreenElement));
  }
  /** Montrer l'invitation : mobile, pas déjà installé, pas refusée, et une façon d'installer existe. */
  get suggest() { return this.mobile && !this.standalone && !this.dismissed && (this.canPrompt || this.ios); }
  async prompt() {
    if (!this.deferred) return;
    await this.deferred.prompt();
    const { outcome } = await this.deferred.userChoice;
    this.deferred = null; this.canPrompt = false;
    if (outcome === "accepted") this.dismiss();
  }
  dismiss() {
    this.dismissed = true;
    try { localStorage.setItem(KEY, "1"); } catch { /* rien */ }
  }
  async toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch { /* refusé par le navigateur */ }
  }
  exitFullscreen() { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
}
export const install = new Install();
