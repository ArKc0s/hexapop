// Connexion via Google, Discord, Twitch et Apple (OAuth 2.0, code d'autorisation côté serveur).
// Chaque fournisseur ne s'active que si ses identifiants sont présents dans l'environnement.
import { createHash, createPrivateKey, createSign, randomBytes } from "node:crypto";
import { config } from "./config.ts";

export type ProviderId = "google" | "discord" | "twitch" | "apple";
export interface Identity { subject: string; email: string | null; emailVerified: boolean; name: string | null }

interface Provider {
  id: ProviderId;
  label: string;
  enabled: () => boolean;
  authUrl: (state: string, challenge: string) => string;
  /** Échange le code contre l'identité vérifiée de l'utilisateur. */
  identity: (code: string, verifier: string) => Promise<Identity>;
  /** Apple renvoie le code en POST (form_post). */
  formPost?: boolean;
}

const env = (k: string) => process.env[k] ?? "";
const redirectUri = (id: ProviderId) => `${config.publicUrl}/api/auth/oauth/${id}/callback`;
const b64url = (b: Buffer) => b.toString("base64url");
export const pkce = () => {
  const verifier = b64url(randomBytes(32));
  return { verifier, challenge: b64url(createHash("sha256").update(verifier).digest()) };
};

async function postForm(url: string, form: Record<string, string>, headers: Record<string, string> = {}) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", ...headers }, body: new URLSearchParams(form) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`échange du code refusé (${r.status}) : ${JSON.stringify(data).slice(0, 200)}`);
  return data as Record<string, unknown>;
}
async function getJson(url: string, token: string) {
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
  if (!r.ok) throw new Error(`profil refusé (${r.status})`);
  return (await r.json()) as Record<string, unknown>;
}
/** Charge utile d'un JWT reçu directement du fournisseur par TLS (pas besoin de revérifier la signature). */
function jwtPayload(jwt: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8"));
}
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const truthy = (v: unknown) => v === true || v === "true";

const google: Provider = {
  id: "google", label: "Google",
  enabled: () => !!env("GOOGLE_CLIENT_ID") && !!env("GOOGLE_CLIENT_SECRET"),
  authUrl: (state, challenge) => `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"), redirect_uri: redirectUri("google"), response_type: "code",
    scope: "openid email profile", state, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account",
  })}`,
  async identity(code, verifier) {
    const t = await postForm("https://oauth2.googleapis.com/token", {
      client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), code, code_verifier: verifier,
      grant_type: "authorization_code", redirect_uri: redirectUri("google"),
    });
    const u = jwtPayload(String(t.id_token));
    return { subject: String(u.sub), email: str(u.email), emailVerified: truthy(u.email_verified), name: str(u.given_name) ?? str(u.name) };
  },
};

const discord: Provider = {
  id: "discord", label: "Discord",
  enabled: () => !!env("DISCORD_CLIENT_ID") && !!env("DISCORD_CLIENT_SECRET"),
  authUrl: (state) => `https://discord.com/oauth2/authorize?${new URLSearchParams({
    client_id: env("DISCORD_CLIENT_ID"), redirect_uri: redirectUri("discord"), response_type: "code",
    scope: "identify email", state, prompt: "none",
  })}`,
  async identity(code) {
    const t = await postForm("https://discord.com/api/oauth2/token", {
      client_id: env("DISCORD_CLIENT_ID"), client_secret: env("DISCORD_CLIENT_SECRET"), code,
      grant_type: "authorization_code", redirect_uri: redirectUri("discord"),
    });
    const u = await getJson("https://discord.com/api/users/@me", String(t.access_token));
    return { subject: String(u.id), email: str(u.email), emailVerified: truthy(u.verified), name: str(u.global_name) ?? str(u.username) };
  },
};

const twitch: Provider = {
  id: "twitch", label: "Twitch",
  enabled: () => !!env("TWITCH_CLIENT_ID") && !!env("TWITCH_CLIENT_SECRET"),
  authUrl: (state) => `https://id.twitch.tv/oauth2/authorize?${new URLSearchParams({
    client_id: env("TWITCH_CLIENT_ID"), redirect_uri: redirectUri("twitch"), response_type: "code",
    scope: "openid user:read:email", state, force_verify: "true",
    claims: JSON.stringify({ id_token: { email: null, email_verified: null, preferred_username: null } }),
  })}`,
  async identity(code) {
    const t = await postForm("https://id.twitch.tv/oauth2/token", {
      client_id: env("TWITCH_CLIENT_ID"), client_secret: env("TWITCH_CLIENT_SECRET"), code,
      grant_type: "authorization_code", redirect_uri: redirectUri("twitch"),
    });
    const u = jwtPayload(String(t.id_token));
    return { subject: String(u.sub), email: str(u.email), emailVerified: truthy(u.email_verified), name: str(u.preferred_username) };
  },
};

/** Apple : le secret client est un JWT ES256 signé avec la clé privée (.p8) du compte développeur. */
function appleSecret(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(Buffer.from(JSON.stringify({ alg: "ES256", kid: env("APPLE_KEY_ID") })));
  const payload = b64url(Buffer.from(JSON.stringify({ iss: env("APPLE_TEAM_ID"), iat: now, exp: now + 600, aud: "https://appleid.apple.com", sub: env("APPLE_CLIENT_ID") })));
  const key = createPrivateKey(env("APPLE_PRIVATE_KEY").replaceAll("\\n", "\n"));
  const sig = createSign("SHA256").update(`${header}.${payload}`).sign({ key, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${b64url(sig)}`;
}
const apple: Provider = {
  id: "apple", label: "Apple", formPost: true,
  enabled: () => ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"].every((k) => !!env(k)),
  authUrl: (state) => `https://appleid.apple.com/auth/authorize?${new URLSearchParams({
    client_id: env("APPLE_CLIENT_ID"), redirect_uri: redirectUri("apple"), response_type: "code",
    response_mode: "form_post", scope: "name email", state,
  })}`,
  async identity(code) {
    const t = await postForm("https://appleid.apple.com/auth/token", {
      client_id: env("APPLE_CLIENT_ID"), client_secret: appleSecret(), code,
      grant_type: "authorization_code", redirect_uri: redirectUri("apple"),
    });
    const u = jwtPayload(String(t.id_token));
    return { subject: String(u.sub), email: str(u.email), emailVerified: truthy(u.email_verified), name: null };
  },
};

export const PROVIDERS: Record<ProviderId, Provider> = { google, discord, twitch, apple };
export const enabledProviders = () => Object.values(PROVIDERS).filter((p) => p.enabled()).map((p) => ({ id: p.id, label: p.label }));

// États en attente (anti-CSRF + PKCE), à usage unique, 10 minutes.
interface Pending { provider: ProviderId; verifier: string; intent: "login" | "link"; userId: number | null; at: number }
const pending = new Map<string, Pending>();
export function newState(p: Omit<Pending, "at">): string {
  const state = b64url(randomBytes(24));
  pending.set(state, { ...p, at: Date.now() });
  return state;
}
export function takeState(state: string, provider: ProviderId): Pending | null {
  const p = pending.get(state);
  pending.delete(state);
  if (!p || p.provider !== provider || Date.now() - p.at > 600_000) return null;
  return p;
}
setInterval(() => { const t = Date.now(); for (const [k, v] of pending) if (t - v.at > 600_000) pending.delete(k); }, 60_000).unref();
