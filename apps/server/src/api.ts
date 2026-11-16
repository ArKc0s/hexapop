// API HTTP JSON sous /api. Authentification : cookie HttpOnly (web) ou en-tête Bearer (mobile).
import type { IncomingMessage, ServerResponse } from "node:http";
import { DEP, type Progress } from "@hexa/game";
import { config } from "./config.ts";
import { db, now } from "./db.ts";
import {
  consumeEmailToken, createSession, deleteSession, emailToken, hashPassword, rateLimit, userFromSession, verifyPassword, type User,
} from "./auth.ts";
import { resetMail, sendMail, verifyMail } from "./mail.ts";
import { dailyNumber, leaderboard, rankOf, today } from "./daily.ts";
import { stats } from "./rooms.ts";

const COOKIE = "hexa_session";
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

const publicUser = (u: User) => ({ id: u.id, pseudo: u.pseudo, email: u.email, emailVerified: !!u.email_verified, home: u.home_dep });

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
    const ok = row ? await verifyPassword(password, row.pass_hash) : false;
    need(row && ok, 401, "bad_credentials", "Identifiant ou mot de passe incorrect.");
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

  "GET /api/me": (_req, res, user) => {
    const u = need(user, 401, "auth_required", "Non connecté.");
    json(res, 200, { user: publicUser(u) });
  },

  "PATCH /api/me": async (req, res, user) => {
    const u = need(user, 401, "auth_required", "Non connecté.");
    const b = await body(req);
    if ("home" in b) {
      const home = s(b.home) || null;
      need(!home || DEP.has(home), 400, "bad_home", "Département de cœur inconnu.");
      db.prepare("UPDATE users SET home_dep = ? WHERE id = ?").run(home, u.id);
    }
    json(res, 200, { user: publicUser({ ...u, home_dep: "home" in b ? (s(b.home) || null) : u.home_dep }) });
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

  "GET /api/daily": (_req, res, user) => {
    const day = today();
    const mine = user ? db.prepare("SELECT points, accuracy, elapsed_ms AS elapsedMs, grid, finished FROM daily_results WHERE day = ? AND user_id = ?").get(day, user.id) : null;
    json(res, 200, { day, number: dailyNumber(day), played: !!mine, mine: mine ?? null, rank: user ? rankOf(day, user.id) : null });
  },

  "GET /api/daily/leaderboard": (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const day = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("day") ?? "") ? url.searchParams.get("day")! : today();
    json(res, 200, leaderboard(day));
  },
};

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = (req.url ?? "/").split("?")[0];
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
