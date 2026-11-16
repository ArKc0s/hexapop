import type { Progress } from "@hexa/game";
import { progress } from "./progress.svelte.ts";

export interface Me { id: number; pseudo: string; email: string; emailVerified: boolean; home: string | null }

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

  async load() {
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
    }
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

  /** Fusionne la progression locale et celle du compte (le serveur garde le plus avancé). */
  async syncProgress() {
    if (!this.me) return;
    const r = await api<{ progress: Progress }>("PUT", "/progress", { progress: progress.data });
    progress.replace(r.progress);
  }
}
export const session = new Session();

let pending: ReturnType<typeof setTimeout> | null = null;
progress.onChange(() => {
  if (!session.me) return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => session.syncProgress().catch(() => {}), 1500);
});
