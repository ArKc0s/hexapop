import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { db, now } from "./db.ts";

// Hachage (et non chiffrement) : le mot de passe n'est jamais stocké ni récupérable.
// Paramètres OWASP pour scrypt : N=2^15 (32 Mio), r=8, p=3, sel aléatoire de 16 octets par compte.
// Format stocké : scrypt$N$r$p$sel$clé — les paramètres voyagent avec le hachage pour pouvoir évoluer.
const PARAMS = { N: 2 ** 15, r: 8, p: 3 };
const SESSION_DAYS = 60;

function derive(pw: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(pw.normalize("NFC"), salt, 32, { N, r, p, maxmem: 256 * N * r }, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(pw, salt, PARAMS.N, PARAMS.r, PARAMS.p);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

/** Vérifie un mot de passe ; `rehash` indique que le hachage utilise d'anciens paramètres. */
export async function verifyPassword(pw: string, stored: string): Promise<{ ok: boolean; rehash: boolean }> {
  const parts = stored.split("$");
  // Ancien format (v0) : scrypt$sel$clé avec N=2^15, r=8, p=1.
  const [N, r, p, s, k] = parts.length === 3 ? [2 ** 15, 8, 1, parts[1], parts[2]] : [Number(parts[1]), Number(parts[2]), Number(parts[3]), parts[4], parts[5]];
  const key = await derive(pw, Buffer.from(String(s), "base64"), N, r, p);
  const expected = Buffer.from(String(k), "base64");
  const ok = key.length === expected.length && timingSafeEqual(key, expected);
  return { ok, rehash: ok && (N !== PARAMS.N || r !== PARAMS.r || p !== PARAMS.p) };
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
  // Dernière activité (au plus une écriture par heure) : sert à la purge des comptes inactifs.
  if (row) db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ? AND COALESCE(last_seen_at, 0) < ?").run(now(), row.id, now() - 3_600_000);
  return row ?? null;
}
/** Prolonge une session encore valide (au plus une écriture par jour) ; renvoie la nouvelle échéance. */
export function touchSession(token: string): number | null {
  const row = db.prepare("SELECT expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?").get(sha(token), now()) as { expires_at: number } | undefined;
  if (!row) return null;
  const next = now() + SESSION_DAYS * 86_400_000;
  if (next - row.expires_at < 86_400_000) return row.expires_at;
  db.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").run(next, sha(token));
  return next;
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
