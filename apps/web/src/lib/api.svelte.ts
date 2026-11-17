import type { Profile, Progress } from "@hexa/game";
import { progress } from "./progress.svelte.ts";
import { profile } from "./profile.svelte.ts";

export interface Me { id: number; pseudo: string; email: string; emailVerified: boolean; home: string | null; providers: string[]; hasPassword: boolean }
export interface ProviderInfo { id: "google" | "discord" | "twitch" | "apple"; label: string }

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("offline", "Serveur injoignable. Vérifie ta connexion.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "http", data.message ?? `Erreur ${res.status}`);
  return data as T;
}

class Session {
  me = $state<Me | null>(null);
  ready = $state(false);
  /** false quand le serveur est absent (prototype statique) : le jeu solo reste jouable. */
  online = $state(true);
  /** Fournisseurs de connexion activés sur le serveur. */
  providers = $state<ProviderInfo[]>([]);

  async load() {
    api<{ providers: ProviderInfo[] }>("GET", "/auth/providers").then((r) => (this.providers = r.providers)).catch(() => {});
    try {
      const r = await api<{ user: Me }>("GET", "/me");
      this.me = r.user;
      await this.syncProgress();
    } catch (e) {
      if (e instanceof ApiError && e.code === "offline") this.online = false;
      // Prototype sans serveur : fetch renvoie du HTML -> pas un compte.
      if (e instanceof ApiError && e.code === "http") this.online = false;
      this.me = null;
    } finally {
      this.ready = true;
      if (!this.online) this.watchBack();
    }
  }

  /** Hors ligne : on revérifie toutes les 20 s, et tout revient tout seul (compte, défi, multi, synchronisation). */
  private retry: ReturnType<typeof setInterval> | null = null;
  private watchBack() {
    if (this.retry) return;
    this.retry = setInterval(async () => {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        if (!r.ok) return;
        clearInterval(this.retry!); this.retry = null;
        this.online = true;
        await this.load();
      } catch { /* toujours hors ligne */ }
    }, 20_000);
  }

  async login(login: string, password: string) {
    const r = await api<{ user: Me }>("POST", "/auth/login", { login, password });
    this.me = r.user;
    await this.syncProgress();
  }
  async register(email: string, pseudo: string, password: string, home: string | null) {
    const r = await api<{ user: Me }>("POST", "/auth/register", { email, pseudo, password, home });
    this.me = r.user;
    await this.syncProgress();
  }
  async logout() {
    await api("POST", "/auth/logout").catch(() => {});
    this.me = null;
  }
  async setHome(home: string | null) {
    const r = await api<{ user: Me }>("PATCH", "/me", { home });
    this.me = r.user;
  }
  async setPseudo(pseudo: string) {
    const r = await api<{ user: Me }>("PATCH", "/me", { pseudo });
    this.me = r.user;
  }
  async unlink(provider: string) {
    const r = await api<{ user: Me }>("DELETE", `/me/oauth/${provider}`);
    this.me = r.user;
  }

  /** Fusionne la progression locale et celle du compte (le serveur garde le plus avancé). */
  async syncProgress() {
    if (!this.me) return;
    await claimGuestDaily();
    const [r, p] = await Promise.all([
      api<{ progress: Progress }>("PUT", "/progress", { progress: progress.data }),
      api<{ profile: Profile }>("PUT", "/profile", { profile: profile.data }),
    ]);
    progress.replace(r.progress);
    profile.replace(p.profile);
  }
}
export const session = new Session();

/** Défi joué en invité aujourd'hui : on le rattache au compte qui vient de se connecter. */
export const GUEST_DAILY = "hexa.dailyGuest";
async function claimGuestDaily() {
  let saved: { day: string; claim?: string } | null = null;
  try { saved = JSON.parse(localStorage.getItem(GUEST_DAILY) ?? "null"); } catch { /* rien */ }
  if (!saved?.claim) return;
  try { await api("POST", "/daily/claim", { claim: saved.claim }); } catch { /* expiré ou déjà joué : on abandonne */ }
  try { localStorage.setItem(GUEST_DAILY, JSON.stringify({ ...saved, claim: undefined })); } catch { /* rien */ }
}

let pending: ReturnType<typeof setTimeout> | null = null;
const scheduleSync = () => {
  if (!session.me) return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => session.syncProgress().catch(() => {}), 1500);
};
progress.onChange(scheduleSync);
profile.onChange(scheduleSync);
