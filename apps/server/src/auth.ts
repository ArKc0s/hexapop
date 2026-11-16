import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { db, now } from "./db.ts";

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SESSION_DAYS = 60;

function scryptAsync(pw: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(pw, salt, 32, SCRYPT, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pw, salt);
  return ["scrypt", salt.toString("base64"), key.toString("base64")].join("$");
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [, s, k] = stored.split("$");
  const key = await scryptAsync(pw, Buffer.from(s, "base64"));
  return timingSafeEqual(key, Buffer.from(k, "base64"));
}

export const sha = (s: string) => createHash("sha256").update(s).digest("base64url");
export const newToken = () => randomBytes(32).toString("base64url");

export interface User { id: number; email: string; pseudo: string; email_verified: number; home_dep: string | null; created_at: number }

export function createSession(userId: number): { token: string; expiresAt: number } {
  const token = newToken();
  const expiresAt = now() + SESSION_DAYS * 86_400_000;
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(sha(token), userId, expiresAt);
  return { token, expiresAt };
}
export function userFromSession(token: string | undefined): User | null {
  if (!token) return null;
  const row = db.prepare(
    `SELECT u.id, u.email, u.pseudo, u.email_verified, u.home_dep, u.created_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`,
  ).get(sha(token), now()) as User | undefined;
  return row ?? null;
}
export function deleteSession(token: string) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
}

export function emailToken(userId: number, kind: "verify" | "reset", ttlMs: number): string {
  const token = newToken();
  db.prepare("DELETE FROM email_tokens WHERE user_id = ? AND kind = ?").run(userId, kind);
  db.prepare("INSERT INTO email_tokens (token_hash, user_id, kind, expires_at) VALUES (?, ?, ?, ?)").run(sha(token), userId, kind, now() + ttlMs);
  return token;
}
export function consumeEmailToken(token: string, kind: "verify" | "reset"): number | null {
  const row = db.prepare("SELECT user_id FROM email_tokens WHERE token_hash = ? AND kind = ? AND expires_at > ?")
    .get(sha(token), kind, now()) as { user_id: number } | undefined;
  if (!row) return null;
  db.prepare("DELETE FROM email_tokens WHERE token_hash = ?").run(sha(token));
  return row.user_id;
}

/** Limiteur en mémoire : `max` tentatives par fenêtre et par clé (IP, email…). */
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const t = now();
  const h = hits.get(key);
  if (!h || h.reset < t) { hits.set(key, { n: 1, reset: t + windowMs }); return true; }
  h.n++;
  return h.n <= max;
}
setInterval(() => { const t = now(); for (const [k, v] of hits) if (v.reset < t) hits.delete(k); }, 60_000).unref();
