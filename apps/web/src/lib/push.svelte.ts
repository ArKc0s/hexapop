// Notifications : abonnement de l'appareil, préférences, signalement d'activité.
import { fadingCodes, liveStreak } from "@hexa/game";
import { api } from "./api.svelte.ts";
import { install } from "./install.svelte.ts";
import { profile } from "./profile.svelte.ts";

export interface PushPrefs { daily: boolean; hour: number; streak: boolean; comeback: boolean }
const PREFS_KEY = "hexa.push.prefs", DISMISS_KEY = "hexa.push.dismissed", ASKED_KEY = "hexa.push.asked";

function b64ToBytes(b64: string) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

class Push {
  /** Le navigateur sait recevoir des notifications (sur iPhone : seulement dans l'appli installée). */
  supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && (!install.ios || install.standalone);
  permission = $state<NotificationPermission>(typeof Notification !== "undefined" ? Notification.permission : "default");
  endpoint = $state<string | null>(null);
  prefs = $state<PushPrefs>((() => { try { return { daily: true, hour: 18, streak: true, comeback: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") }; } catch { return { daily: true, hour: 18, streak: true, comeback: true }; } })());
  dismissed = $state((() => { try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; } })());
  available = $state(false);
  /** La demande unique (à la connexion) a déjà été faite sur cet appareil. */
  asked = $state((() => { try { return localStorage.getItem(ASKED_KEY) === "1"; } catch { return false; } })());
  markAsked() {
    this.asked = true; this.dismiss();
    try { localStorage.setItem(ASKED_KEY, "1"); } catch { /* rien */ }
  }

  async init() {
    if (!this.supported) return;
    try {
      await api("GET", "/push/key");
      this.available = true;
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      this.endpoint = sub?.endpoint ?? null;
      if (this.endpoint) this.reportActivity();
    } catch { this.available = false; }
  }
  /** Proposer les rappels : possible, pas encore abonné, pas refusé ni écarté. */
  get suggest() { return this.supported && this.available && !this.endpoint && this.permission !== "denied" && !this.dismissed; }

  /** À appeler depuis un clic (exigé par les navigateurs). */
  async subscribe(): Promise<boolean> {
    if (!this.supported) return false;
    this.permission = await Notification.requestPermission();
    if (this.permission !== "granted") return false;
    const { publicKey } = await api<{ publicKey: string }>("GET", "/push/key");
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
    await api("POST", "/push/subscribe", { subscription: sub.toJSON(), prefs: this.prefs });
    this.endpoint = sub.endpoint;
    this.reportActivity();
    return true;
  }
  async unsubscribe() {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await api("POST", "/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
    this.endpoint = null;
  }
  async savePrefs(p: PushPrefs) {
    this.prefs = p;
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* rien */ }
    if (this.endpoint) await api("POST", "/push/prefs", { endpoint: this.endpoint, prefs: p });
  }
  dismiss() { this.dismissed = true; try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* rien */ } }

  /** Signale au serveur le dernier jour joué, la série et les départements qui s'effacent. */
  reportActivity() {
    if (!this.endpoint) return;
    const p = profile.data, now = Date.now();
    const atlas = p.atlas ?? "france";
    const fading = fadingCodes(p.know ?? {}, now, atlas).length;
    if (!p.streak.last) return;
    api("POST", "/push/activity", { endpoint: this.endpoint, day: p.streak.last, streak: liveStreak(p, now), fading, atlas }).catch(() => {});
  }
}
export const push = new Push();
profile.onChange(() => push.reportActivity());
