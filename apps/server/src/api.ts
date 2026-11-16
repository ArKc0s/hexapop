// API HTTP JSON sous /api. Authentification : cookie HttpOnly (web) ou en-tête Bearer (mobile).
import type { IncomingMessage, ServerResponse } from "node:http";
import { DEP, mergeProfiles, sanitizeProfile, type Progress } from "@hexa/game";
import { config } from "./config.ts";
import { db, now } from "./db.ts";
import {
  consumeEmailToken, createSession, deleteSession, emailToken, hashPassword, rateLimit, touchSession, userFromSession, verifyPassword, type User,
} from "./auth.ts";
import { resetMail, sendMail, verifyMail } from "./mail.ts";
import { dailyNumber, leaderboard, rankOf, redeemClaim, today } from "./daily.ts";
import { stats } from "./rooms.ts";
import { DEFAULT_PREFS, cleanPrefs, pushEnabled, sendTo, validEndpoint, vapidPublicKey } from "./push.ts";
import { PROVIDERS, enabledProviders, newState, pkce, takeState, type Identity, type ProviderId } from "./oauth.ts";

const COOKIE = "hexa_session";
const DUMMY_HASH = await hashPassword("factice-" + Math.random());
const secureCookie = config.publicUrl.startsWith("https");

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}

export function clientIp(req: IncomingMessage): string {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string") return cf;
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0].trim();
  return req.socket.remoteAddress ?? "?";
}

export function sessionToken(req: IncomingMessage): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const m = /(?:^|;\s*)hexa_session=([^;]+)/.exec(req.headers.cookie ?? "");
  return m?.[1];
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += c.length;
    if (size > 64 * 1024) throw new HttpError(413, "too_large", "Requête trop volumineuse.");
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new HttpError(400, "bad_json", "JSON invalide."); }
}

function json(res: ServerResponse, status: number, data: unknown, headers: Record<string, string | string[]> = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(data));
}

function setCookie(token: string, expiresAt: number) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secureCookie ? "; Secure" : ""}`;
}
const clearCookie = `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie ? "; Secure" : ""}`;

const publicUser = (u: User) => {
  const links = (db.prepare("SELECT provider FROM oauth_identities WHERE user_id = ?").all(u.id) as { provider: string }[]).map((r) => r.provider);
  const pw = db.prepare("SELECT pass_hash FROM users WHERE id = ?").get(u.id) as { pass_hash: string } | undefined;
  return { id: u.id, pseudo: u.pseudo, email: u.email, emailVerified: !!u.email_verified, home: u.home_dep, providers: links, hasPassword: !!pw?.pass_hash };
};

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const PSEUDO_RE = /^[\p{L}\p{N}_.\- ]{2,20}$/u;
function need<T>(v: T | undefined | null | false, status: number, code: string, msg: string): T {
  if (!v) throw new HttpError(status, code, msg);
  return v;
}
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

async function sendVerification(u: { id: number; pseudo: string; email: string }) {
  const t = emailToken(u.id, "verify", 48 * 3_600_000);
  await sendMail(u.email, "Confirme ton adresse Hexa", verifyMail(u.pseudo, `${config.publicUrl}/#verifier=${t}`));
}

type Handler = (req: IncomingMessage, res: ServerResponse, user: User | null) => Promise<void> | void;
const routes: Record<string, Handler> = {
  "GET /api/health": (_req, res) => json(res, 200, { ok: true, ...stats() }),

  "POST /api/auth/register": async (req, res) => {
    need(rateLimit("reg:" + clientIp(req), 10, 3_600_000), 429, "rate_limited", "Trop d'inscriptions depuis cette connexion, réessaie plus tard.");
    const b = await body(req);
    const email = s(b.email).toLowerCase(), pseudo = s(b.pseudo), password = typeof b.password === "string" ? b.password : "";
    const home = s(b.home) || null;
    need(EMAIL_RE.test(email), 400, "bad_email", "Adresse email invalide.");
    need(PSEUDO_RE.test(pseudo), 400, "bad_pseudo", "Pseudo : 2 à 20 caractères (lettres, chiffres, espace, . _ -).");
    need(password.length >= 8 && password.length <= 200, 400, "bad_password", "Mot de passe : au moins 8 caractères.");
    need(!home || DEP.has(home), 400, "bad_home", "Département de cœur inconnu.");
    need(!db.prepare("SELECT 1 FROM users WHERE email = ?").get(email), 409, "email_taken", "Cette adresse a déjà un compte.");
    need(!db.prepare("SELECT 1 FROM users WHERE pseudo = ?").get(pseudo), 409, "pseudo_taken", "Ce pseudo est déjà pris.");
    const hash = await hashPassword(password);
    const { lastInsertRowid } = db.prepare("INSERT INTO users (email, pseudo, pass_hash, home_dep, created_at) VALUES (?, ?, ?, ?, ?)").run(email, pseudo, hash, home, now());
    const id = Number(lastInsertRowid);
    await sendVerification({ id, pseudo, email }).catch((e) => console.error("envoi email", e));
    const sess = createSession(id);
    const u = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as User;
    json(res, 201, { user: publicUser(u), token: sess.token }, { "set-cookie": setCookie(sess.token, sess.expiresAt) });
  },

  "POST /api/auth/login": async (req, res) => {
    const b = await body(req);
    const login = s(b.login), password = typeof b.password === "string" ? b.password : "";
    need(rateLimit("login:" + clientIp(req), 30, 900_000) && rateLimit("login:" + login.toLowerCase(), 10, 900_000), 429, "rate_limited", "Trop de tentatives, réessaie dans 15 minutes.");
    const row = db.prepare("SELECT * FROM users WHERE email = ? OR pseudo = ?").get(login, login) as (User & { pass_hash: string }) | undefined;
    // Sans compte, on calcule quand même un hachage : même durée de réponse, pas d'énumération des comptes.
    const check = await verifyPassword(password, row?.pass_hash || DUMMY_HASH);
    if (row && !row.pass_hash) check.ok = false; // compte créé via Google, Discord… : pas de mot de passe
    need(row && check.ok, 401, "bad_credentials", "Identifiant ou mot de passe incorrect.");
    if (check.rehash) db.prepare("UPDATE users SET pass_hash = ? WHERE id = ?").run(await hashPassword(password), row!.id);
    const sess = createSession(row!.id);
    json(res, 200, { user: publicUser(row!), token: sess.token }, { "set-cookie": setCookie(sess.token, sess.expiresAt) });
  },

  "POST /api/auth/logout": (req, res) => {
    const t = sessionToken(req);
    if (t) deleteSession(t);
    json(res, 200, { ok: true }, { "set-cookie": clearCookie });
  },

  "POST /api/auth/verify": async (req, res) => {
    const b = await body(req);
    const id = need(consumeEmailToken(s(b.token), "verify"), 400, "bad_token", "Lien invalide ou expiré.");
    db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(id);
    json(res, 200, { ok: true });
  },

  "POST /api/auth/resend": async (req, res, user) => {
    const u = need(user, 401, "auth_required", "Connecte-toi d'abord.");
    need(rateLimit("resend:" + u.id, 3, 3_600_000), 429, "rate_limited", "Email déjà renvoyé, vérifie tes spams.");
    await sendVerification(u);
    json(res, 200, { ok: true });
  },

  "POST /api/auth/forgot": async (req, res) => {
    const b = await body(req);
    const email = s(b.email).toLowerCase();
    if (rateLimit("forgot:" + clientIp(req), 5, 3_600_000) && rateLimit("forgot:" + email, 3, 3_600_000)) {
      const u = db.prepare("SELECT id, pseudo, email FROM users WHERE email = ?").get(email) as { id: number; pseudo: string; email: string } | undefined;
      if (u) {
        const t = emailToken(u.id, "reset", 3_600_000);
        await sendMail(u.email, "Nouveau mot de passe Hexa", resetMail(u.pseudo, `${config.publicUrl}/#nouveau-mdp=${t}`)).catch((e) => console.error("envoi email", e));
      }
    }
    // Même réponse que l'adresse existe ou non.
    json(res, 200, { ok: true });
  },

  "POST /api/auth/reset": async (req, res) => {
    const b = await body(req);
    const password = typeof b.password === "string" ? b.password : "";
    need(password.length >= 8 && password.length <= 200, 400, "bad_password", "Mot de passe : au moins 8 caractères.");
    const id = need(consumeEmailToken(s(b.token), "reset"), 400, "bad_token", "Lien invalide ou expiré.");
    db.prepare("UPDATE users SET pass_hash = ?, email_verified = 1 WHERE id = ?").run(await hashPassword(password), id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    const sess = createSession(id);
    json(res, 200, { ok: true, token: sess.token }, { "set-cookie": setCookie(sess.token, sess.expiresAt) });
  },

  "GET /api/me": (req, res, user) => {
    const u = need(user, 401, "auth_required", "Non connecté.");
    // Session glissante : chaque visite repousse l'expiration (60 jours) du cookie et de la session.
    const t = sessionToken(req);
    const exp = t ? touchSession(t) : null;
    json(res, 200, { user: publicUser(u) }, exp && !req.headers.authorization ? { "set-cookie": setCookie(t!, exp) } : {});
  },

  "PATCH /api/me": async (req, res, user) => {
    const u = need(user, 401, "auth_required", "Non connecté.");
    const b = await body(req);
    if ("pseudo" in b) {
      const pseudo = s(b.pseudo);
      need(PSEUDO_RE.test(pseudo), 400, "bad_pseudo", "Pseudo : 2 à 20 caractères (lettres, chiffres, espace, . _ -).");
      need(!db.prepare("SELECT 1 FROM users WHERE pseudo = ? AND id != ?").get(pseudo, u.id), 409, "pseudo_taken", "Ce pseudo est déjà pris.");
      db.prepare("UPDATE users SET pseudo = ? WHERE id = ?").run(pseudo, u.id);
    }
    if ("home" in b) {
      const home = s(b.home) || null;
      need(!home || DEP.has(home), 400, "bad_home", "Département de cœur inconnu.");
      db.prepare("UPDATE users SET home_dep = ? WHERE id = ?").run(home, u.id);
    }
    json(res, 200, { user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(u.id) as unknown as User) });
  },

  "GET /api/profile": (_req, res, user) => {
    const u = need(user, 401, "auth_required", "Non connecté.");
    const row = db.prepare("SELECT data FROM profiles WHERE user_id = ?").get(u.id) as { data: string } | undefined;
    json(res, 200, { profile: sanitizeProfile(row ? JSON.parse(row.data) : null) });
  },

  /** Profil de jeu (XP, série, étoiles, album, badges) : fusion avec la version du serveur. */
  "PUT /api/profile": async (req, res, user) => {
    const u = need(user, 401, "auth_required", "Non connecté.");
    const b = await body(req);
    const row = db.prepare("SELECT data FROM profiles WHERE user_id = ?").get(u.id) as { data: string } | undefined;
    const merged = mergeProfiles(sanitizeProfile(row ? JSON.parse(row.data) : null), sanitizeProfile(b.profile));
    db.prepare("INSERT INTO profiles (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at")
      .run(u.id, JSON.stringify(merged), now());
    json(res, 200, { profile: merged });
  },

  /** Droit d'accès et de portabilité : toutes les données du compte, en JSON. */
  "GET /api/me/export": (_req, res, user) => {
    const u = need(user, 401, "auth_required", "Non connecté.");
    const row = db.prepare("SELECT id, email, pseudo, email_verified, home_dep, created_at, last_seen_at FROM users WHERE id = ?").get(u.id) as Record<string, unknown>;
    const progressRow = db.prepare("SELECT data, updated_at FROM progress WHERE user_id = ?").get(u.id) as { data: string; updated_at: number } | undefined;
    const daily = db.prepare("SELECT day, points, accuracy, elapsed_ms, grid, finished, created_at FROM daily_results WHERE user_id = ? ORDER BY day").all(u.id);
    const profileRow = db.prepare("SELECT data FROM profiles WHERE user_id = ?").get(u.id) as { data: string } | undefined;
    const sessions = db.prepare("SELECT COUNT(*) AS n, MAX(expires_at) AS until FROM sessions WHERE user_id = ?").get(u.id);
    const iso = (v: unknown) => (typeof v === "number" ? new Date(v).toISOString() : v);
    json(res, 200, {
      exportedAt: new Date().toISOString(),
      account: { ...row, created_at: iso(row.created_at), last_seen_at: iso(row.last_seen_at), password: "haché avec scrypt, non récupérable" },
      progress: progressRow ? JSON.parse(progressRow.data) : {},
      gameProfile: profileRow ? JSON.parse(profileRow.data) : null,
      linkedAccounts: db.prepare("SELECT provider, email, created_at FROM oauth_identities WHERE user_id = ?").all(u.id),
      notificationDevices: db.prepare("SELECT prefs, last_played_day, created_at FROM push_subs WHERE user_id = ?").all(u.id),
      dailyResults: daily,
      activeSessions: sessions,
    }, { "content-disposition": `attachment; filename="hexa-${u.pseudo}-donnees.json"` });
  },

  /** Droit à l'effacement : suppression immédiate et définitive (cascade sur toutes les tables). */
  "DELETE /api/me": async (req, res, user) => {
    const u = need(user, 401, "auth_required", "Non connecté.");
    const b = await body(req);
    const row = db.prepare("SELECT pass_hash FROM users WHERE id = ?").get(u.id) as { pass_hash: string };
    if (row.pass_hash) {
      const check = await verifyPassword(typeof b.password === "string" ? b.password : "", row.pass_hash);
      need(check.ok, 403, "bad_password", "Mot de passe incorrect.");
    } else {
      need(s(b.confirm).toLowerCase() === u.pseudo.toLowerCase(), 403, "bad_confirm", "Tape ton pseudo pour confirmer.");
    }
    db.prepare("DELETE FROM users WHERE id = ?").run(u.id);
    json(res, 200, { ok: true }, { "set-cookie": clearCookie });
  },

  "GET /api/progress": (_req, res, user) => {
    const u = need(user, 401, "auth_required", "Non connecté.");
    const row = db.prepare("SELECT data, updated_at FROM progress WHERE user_id = ?").get(u.id) as { data: string; updated_at: number } | undefined;
    json(res, 200, { progress: row ? JSON.parse(row.data) : {}, updatedAt: row?.updated_at ?? 0 });
  },

  /** Fusion : pour chaque département, on garde l'état le plus avancé (le plus de révisions). */
  "PUT /api/progress": async (req, res, user) => {
    const u = need(user, 401, "auth_required", "Non connecté.");
    const b = await body(req);
    const incoming = (b.progress && typeof b.progress === "object" ? b.progress : {}) as Progress;
    const row = db.prepare("SELECT data FROM progress WHERE user_id = ?").get(u.id) as { data: string } | undefined;
    const merged: Progress = row ? JSON.parse(row.data) : {};
    for (const [code, st] of Object.entries(incoming)) {
      if (!DEP.has(code) || !st || typeof st !== "object") continue;
      const clean = { box: Math.min(6, Math.max(0, Number(st.box) | 0)), due: Number(st.due) || 0, seen: Math.max(0, Number(st.seen) | 0), correct: Math.max(0, Number(st.correct) | 0) };
      if (!merged[code] || clean.seen > merged[code].seen || (clean.seen === merged[code].seen && clean.due > merged[code].due)) merged[code] = clean;
    }
    db.prepare("INSERT INTO progress (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at")
      .run(u.id, JSON.stringify(merged), now());
    json(res, 200, { progress: merged });
  },

  // ---------- notifications ----------
  "GET /api/push/key": (_req, res) => {
    need(pushEnabled, 404, "push_off", "Notifications indisponibles.");
    json(res, 200, { publicKey: vapidPublicKey() });
  },
  "POST /api/push/subscribe": async (req, res, user) => {
    need(pushEnabled, 404, "push_off", "Notifications indisponibles.");
    need(rateLimit("push:" + clientIp(req), 20, 3_600_000), 429, "rate_limited", "Trop de demandes.");
    const b = await body(req);
    const sub = (b.subscription ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    need(validEndpoint(sub.endpoint) && typeof sub.keys?.p256dh === "string" && typeof sub.keys?.auth === "string", 400, "bad_subscription", "Abonnement invalide.");
    const prefs = cleanPrefs(b.prefs ?? DEFAULT_PREFS);
    db.prepare(`INSERT INTO push_subs (endpoint, p256dh, auth, user_id, prefs, created_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, user_id = COALESCE(excluded.user_id, push_subs.user_id), prefs = excluded.prefs`)
      .run(sub.endpoint as string, sub.keys!.p256dh as string, sub.keys!.auth as string, user?.id ?? null, JSON.stringify(prefs), now());
    json(res, 200, { ok: true, prefs });
  },
  "POST /api/push/prefs": async (req, res) => {
    const b = await body(req);
    need(validEndpoint(b.endpoint), 400, "bad_subscription", "Abonnement invalide.");
    const prefs = cleanPrefs(b.prefs);
    db.prepare("UPDATE push_subs SET prefs = ? WHERE endpoint = ?").run(JSON.stringify(prefs), b.endpoint as string);
    json(res, 200, { ok: true, prefs });
  },
  "POST /api/push/unsubscribe": async (req, res) => {
    const b = await body(req);
    if (typeof b.endpoint === "string") db.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(b.endpoint);
    json(res, 200, { ok: true });
  },
  /** L'appareil signale qu'on a joué (jour, série, départements qui s'effacent) : sert à choisir le bon rappel. */
  "POST /api/push/activity": async (req, res) => {
    const b = await body(req);
    if (validEndpoint(b.endpoint) && /^\d{4}-\d{2}-\d{2}$/.test(String(b.day))) {
      db.prepare("UPDATE push_subs SET last_played_day = ?, streak = ?, fading = ?, comeback_stage = 0 WHERE endpoint = ?")
        .run(String(b.day), Math.min(10_000, Math.max(0, Number(b.streak) | 0)), Math.min(101, Math.max(0, Number(b.fading) | 0)), b.endpoint as string);
    }
    json(res, 200, { ok: true });
  },
  "POST /api/push/test": async (req, res) => {
    const b = await body(req);
    need(rateLimit("pushtest:" + clientIp(req), 5, 3_600_000), 429, "rate_limited", "Trop d'essais, réessaie plus tard.");
    const s = db.prepare("SELECT endpoint, p256dh, auth FROM push_subs WHERE endpoint = ?").get(String(b.endpoint)) as { endpoint: string; p256dh: string; auth: string } | undefined;
    need(s, 404, "not_subscribed", "Cet appareil n'est pas abonné.");
    const ok = await sendTo(s!, { title: "Hexa est prêt à te prévenir 🎉", body: "Tu recevras au plus une notification par jour.", url: "/", tag: "test" });
    json(res, ok ? 200 : 502, { ok });
  },

  "GET /api/auth/providers": (_req, res) => json(res, 200, { providers: enabledProviders() }),

  "GET /api/daily": (_req, res, user) => {
    const day = today();
    const mine = user ? db.prepare("SELECT points, accuracy, elapsed_ms AS elapsedMs, grid, finished FROM daily_results WHERE day = ? AND user_id = ?").get(day, user.id) : null;
    json(res, 200, { day, number: dailyNumber(day), played: !!mine, mine: mine ?? null, rank: user ? rankOf(day, user.id) : null });
  },

  /** Rattacher au compte un défi joué juste avant en invité. */
  "POST /api/daily/claim": async (req, res, user) => {
    const u = need(user, 401, "auth_required", "Connecte-toi d'abord.");
    const b = await body(req);
    const r = redeemClaim(s(b.claim), u.id);
    need(r !== "expired", 410, "claim_expired", "Ce résultat ne peut plus être rattaché (il date d'un autre jour).");
    need(r !== "already", 409, "daily_done", "Ton compte a déjà un résultat pour le défi d'aujourd'hui.");
    json(res, 200, { ok: true, rank: r });
  },

  "GET /api/daily/leaderboard": (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const day = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("day") ?? "") ? url.searchParams.get("day")! : today();
    json(res, 200, leaderboard(day));
  },
};

// ---------- connexion via Google, Discord, Twitch, Apple ----------
function redirect(res: ServerResponse, to: string, headers: Record<string, string> = {}) {
  res.writeHead(302, { location: to, "cache-control": "no-store", ...headers });
  res.end();
}

/** Pseudo libre dérivé du nom chez le fournisseur. */
function freePseudo(name: string | null): string {
  let base = (name ?? "").normalize("NFC").replace(/[^\p{L}\p{N}_.\- ]/gu, "").trim().slice(0, 16);
  if (base.length < 2) base = "Joueur";
  if (!db.prepare("SELECT 1 FROM users WHERE pseudo = ?").get(base)) return base;
  for (let i = 0; i < 50; i++) {
    const p = `${base.slice(0, 15)}${Math.floor(Math.random() * 9000 + 1000)}`;
    if (!db.prepare("SELECT 1 FROM users WHERE pseudo = ?").get(p)) return p;
  }
  throw new HttpError(500, "pseudo", "Impossible de choisir un pseudo.");
}

/**
 * Trouve ou crée le compte correspondant à une identité externe.
 * Liaison automatique seulement si le fournisseur garantit l'email. Si le compte local n'avait jamais
 * confirmé son email, son mot de passe est annulé : il a pu être créé par quelqu'un d'autre.
 */
export function resolveIdentity(provider: ProviderId, id: Identity): { userId: number; created: boolean; linked: boolean } {
  const known = db.prepare("SELECT user_id FROM oauth_identities WHERE provider = ? AND subject = ?").get(provider, id.subject) as { user_id: number } | undefined;
  if (known) return { userId: known.user_id, created: false, linked: false };
  const link = (userId: number) => db.prepare("INSERT INTO oauth_identities (provider, subject, user_id, email, created_at) VALUES (?, ?, ?, ?, ?)").run(provider, id.subject, userId, id.email, now());
  const email = id.email?.toLowerCase() ?? null;
  if (!email || !id.emailVerified) throw new HttpError(400, "email_unverified", "Ton email n'est pas vérifié chez ce fournisseur : vérifie-le là-bas, ou crée un compte classique.");
  const existing = db.prepare("SELECT id, email_verified FROM users WHERE email = ?").get(email) as { id: number; email_verified: number } | undefined;
  if (existing) {
    if (!existing.email_verified) {
      db.prepare("UPDATE users SET email_verified = 1, pass_hash = '' WHERE id = ?").run(existing.id);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(existing.id);
    }
    link(existing.id);
    return { userId: existing.id, created: false, linked: true };
  }
  const { lastInsertRowid } = db.prepare("INSERT INTO users (email, pseudo, pass_hash, email_verified, created_at) VALUES (?, ?, '', 1, ?)").run(email, freePseudo(id.name), now());
  const userId = Number(lastInsertRowid);
  link(userId);
  return { userId, created: true, linked: false };
}

async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  let raw = "";
  for await (const c of req) { raw += c; if (raw.length > 16_384) break; }
  return new URLSearchParams(raw);
}

async function oauthRoute(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
  const m = /^\/api\/auth\/oauth\/(google|discord|twitch|apple)\/(start|callback)$/.exec(path);
  const un = /^\/api\/me\/oauth\/(google|discord|twitch|apple)$/.exec(path);
  if (un && req.method === "DELETE") {
    const u = need(userFromSession(sessionToken(req)), 401, "auth_required", "Non connecté.");
    const pw = (db.prepare("SELECT pass_hash FROM users WHERE id = ?").get(u.id) as { pass_hash: string }).pass_hash;
    const others = (db.prepare("SELECT COUNT(*) AS n FROM oauth_identities WHERE user_id = ? AND provider != ?").get(u.id, un[1]) as { n: number }).n;
    need(pw || others > 0, 400, "last_login", "Définis d'abord un mot de passe ou lie un autre compte : sinon tu ne pourrais plus te connecter.");
    db.prepare("DELETE FROM oauth_identities WHERE user_id = ? AND provider = ?").run(u.id, un[1]);
    json(res, 200, { user: publicUser(u) });
    return true;
  }
  if (!m) return false;
  const provider = PROVIDERS[m[1] as ProviderId];
  if (!provider.enabled()) { redirect(res, "/#oauth-erreur=indisponible"); return true; }

  if (m[2] === "start") {
    need(req.method === "GET", 405, "method", "Méthode non permise.");
    need(rateLimit("oauth:" + clientIp(req), 30, 600_000), 429, "rate_limited", "Trop de tentatives, réessaie plus tard.");
    const intent = new URL(req.url ?? "/", "http://x").searchParams.get("intent") === "link" ? "link" : "login";
    const user = userFromSession(sessionToken(req));
    if (intent === "link" && !user) { redirect(res, "/#oauth-erreur=connexion-requise"); return true; }
    const { verifier, challenge } = pkce();
    const state = newState({ provider: provider.id, verifier, intent, userId: user?.id ?? null });
    redirect(res, provider.authUrl(state, challenge));
    return true;
  }

  // Retour du fournisseur (GET, ou POST pour Apple)
  const params = req.method === "POST" ? await readForm(req) : new URL(req.url ?? "/", "http://x").searchParams;
  const pending = takeState(params.get("state") ?? "", provider.id);
  if (!pending) { redirect(res, "/#oauth-erreur=expire"); return true; }
  if (params.get("error") || !params.get("code")) { redirect(res, "/#oauth-erreur=annule"); return true; }
  try {
    const identity = await provider.identity(params.get("code")!, pending.verifier);
    if (pending.intent === "link") {
      const owner = db.prepare("SELECT user_id FROM oauth_identities WHERE provider = ? AND subject = ?").get(provider.id, identity.subject) as { user_id: number } | undefined;
      if (owner && owner.user_id !== pending.userId) { redirect(res, "/#oauth-erreur=deja-lie"); return true; }
      if (!owner) db.prepare("INSERT INTO oauth_identities (provider, subject, user_id, email, created_at) VALUES (?, ?, ?, ?, ?)").run(provider.id, identity.subject, pending.userId, identity.email, now());
      redirect(res, `/#oauth-ok=lie-${provider.id}`);
      return true;
    }
    const r = resolveIdentity(provider.id, identity);
    const sess = createSession(r.userId);
    redirect(res, `/#oauth-ok=${r.created ? "nouveau" : r.linked ? "lie-auto" : "connecte"}`, { "set-cookie": setCookie(sess.token, sess.expiresAt) });
  } catch (e) {
    const code = e instanceof HttpError ? e.code : "fournisseur";
    if (!(e instanceof HttpError)) console.error(`[oauth ${provider.id}]`, e);
    redirect(res, `/#oauth-erreur=${code}`);
  }
  return true;
}

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = (req.url ?? "/").split("?")[0];
  try {
    if (await oauthRoute(req, res, path)) return;
  } catch (e) {
    if (e instanceof HttpError) return json(res, e.status, { error: e.code, message: e.message });
    console.error(e); return json(res, 500, { error: "internal", message: "Erreur interne." });
  }
  const route = routes[`${req.method} ${path}`];
  try {
    if (!route) throw new HttpError(404, "not_found", "Route inconnue.");
    if (req.method !== "GET") {
      // Protection CSRF pour le cookie : les requêtes d'écriture doivent être en JSON.
      const ct = req.headers["content-type"] ?? "";
      if (req.headers["content-length"] !== "0" && req.headers["content-length"] && !ct.includes("application/json")) {
        throw new HttpError(415, "bad_content_type", "Envoie du JSON.");
      }
    }
    await route(req, res, userFromSession(sessionToken(req)));
  } catch (e) {
    if (e instanceof HttpError) json(res, e.status, { error: e.code, message: e.message });
    else { console.error(e); json(res, 500, { error: "internal", message: "Erreur interne." }); }
  }
}
