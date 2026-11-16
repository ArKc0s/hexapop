import { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";

export const db = new DatabaseSync(config.dbPath);
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 2000;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pseudo TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  home_dep TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('verify', 'reset')),
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_results (
  day TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  accuracy REAL NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  grid TEXT NOT NULL,
  finished INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (day, user_id)
);
CREATE INDEX IF NOT EXISTS daily_rank ON daily_results(day, points DESC, elapsed_ms ASC);
`);

// Migrations légères
const userCols = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name);
if (!userCols.includes("last_seen_at")) db.exec("ALTER TABLE users ADD COLUMN last_seen_at INTEGER");

export const now = () => Date.now();

// ---------- Conservation des données (RGPD, minimisation) ----------
export const RETENTION = {
  /** Compte jamais confirmé : supprimé après 30 jours. */
  unverifiedMs: 30 * 86_400_000,
  /** Compte inactif : supprimé après 3 ans sans connexion (recommandation CNIL). */
  inactiveMs: 3 * 365 * 86_400_000,
};

export function purge(t = now()): Record<string, number> {
  const out: Record<string, number> = {};
  out.sessions = Number(db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(t).changes);
  out.emailTokens = Number(db.prepare("DELETE FROM email_tokens WHERE expires_at < ?").run(t).changes);
  out.unverified = Number(db.prepare("DELETE FROM users WHERE email_verified = 0 AND created_at < ?").run(t - RETENTION.unverifiedMs).changes);
  out.inactive = Number(db.prepare("DELETE FROM users WHERE COALESCE(last_seen_at, created_at) < ?").run(t - RETENTION.inactiveMs).changes);
  return out;
}
