import { ATLASES } from "@hexa/game";
// Notifications (Web Push) : rappel du défi, série en danger, retour en douceur.
// Opt-in par appareil, réglable par type, une notification par jour au maximum.
import { life } from "./life.ts";
import * as webpush from "web-push";
import { db, now } from "./db.ts";
import { dailyNumber, today } from "./daily.ts";

const PUB = process.env.VAPID_PUBLIC_KEY ?? "", PRIV = process.env.VAPID_PRIVATE_KEY ?? "";
export const pushEnabled = !!PUB && !!PRIV;
if (pushEnabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contact@hexapop.app", PUB, PRIV);
export const vapidPublicKey = () => PUB;

db.exec(`
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  prefs TEXT NOT NULL,
  last_played_day TEXT,
  streak INTEGER NOT NULL DEFAULT 0,
  fading INTEGER NOT NULL DEFAULT 0,
  comeback_stage INTEGER NOT NULL DEFAULT 0,
  last_sent_day TEXT,
  created_at INTEGER NOT NULL
);
`);

/** Services de notification officiels : le serveur ne contacte jamais une autre adresse (anti-SSRF). */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/];
export function validEndpoint(e: unknown): e is string {
  if (typeof e !== "string" || e.length > 1000) return false;
  try { const u = new URL(e); return u.protocol === "https:" && PUSH_HOSTS.some((r) => r.test(u.hostname)); } catch { return false; }
}

export interface PushPrefs { daily: boolean; hour: number; streak: boolean; comeback: boolean }
export const DEFAULT_PREFS: PushPrefs = { daily: true, hour: 18, streak: true, comeback: true };
export function cleanPrefs(p: unknown): PushPrefs {
  const o = (p && typeof p === "object" ? p : {}) as Partial<PushPrefs>;
  const hour = Number.isInteger(o.hour) ? Math.min(22, Math.max(7, o.hour as number)) : DEFAULT_PREFS.hour;
  return { daily: o.daily !== false, hour, streak: o.streak !== false, comeback: o.comeback !== false };
}

// Atlas que le joueur a ouvert en dernier (les rappels parlent de ses régions, ou de ses départements).
{
  const cols = (db.prepare("PRAGMA table_info(push_subs)").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("atlas")) db.exec("ALTER TABLE push_subs ADD COLUMN atlas TEXT");
}

interface Sub { atlas?: string | null; endpoint: string; p256dh: string; auth: string; prefs: string; last_played_day: string | null; streak: number; fading: number; comeback_stage: number; last_sent_day: string | null }

/** Heure et jour à Paris. */
function parisNow(t = now()) {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).formatToParts(t);
  return { day: today(t), hour: Number(parts.find((x) => x.type === "hour")?.value ?? 0) };
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export interface Message { title: string; body: string; url: string; tag: string }

/** Quelle notification envoyer maintenant à cet appareil (ou aucune). Pure : testable. */
export function decide(s: Pick<Sub, "last_played_day" | "streak" | "fading" | "comeback_stage" | "last_sent_day"> & { atlas?: string | null }, prefs: PushPrefs, day: string, hour: number): { msg: Message; stage?: number } | null {
  // Les mots de l'atlas du joueur (un atlas = un monde).
  const A = s.atlas === "regions" ? ATLASES.regions : ATLASES.france;
  const what = `${A.dailyRounds} ${A.des}`;
  if (s.last_sent_day === day) return null; // une par jour au maximum
  const played = s.last_played_day;
  if (played === day) return null; // déjà joué aujourd'hui : on laisse tranquille
  const idle = played ? daysBetween(played, day) : 99;
  const n = dailyNumber(day);
  // Série en danger : à partir de 20 h, si joué hier et série d'au moins 3 jours
  if (prefs.streak && idle === 1 && s.streak >= 3) {
    if (hour >= 20) return { msg: { title: `Ta série de ${s.streak} jours s'arrête à minuit 🔥`, body: `Le défi n° ${n} t'attend : ${what}, un seul essai.`, url: "/#defi", tag: "serie" } };
    return null; // on attend 20 h plutôt que d'envoyer le rappel du défi
  }
  // Rappel du défi : à l'heure choisie, pour les joueurs actifs (venus dans les 3 derniers jours)
  if (prefs.daily && idle <= 3 && hour >= prefs.hour) {
    return { msg: { title: `Le défi n° ${n} est arrivé 🎯`, body: `${what}, les mêmes pour tout le monde, un seul essai.`, url: "/#defi", tag: "defi" } };
  }
  // Retour en douceur : après 4 jours, puis 10 jours, puis plus rien
  if (prefs.comeback && hour >= prefs.hour && played) {
    const stage = idle >= 10 ? 2 : idle >= 4 ? 1 : 0;
    if (stage > s.comeback_stage) {
      const body = s.fading >= 3 ? `${s.fading} ${A.des} commencent à s'effacer de ta carte. Une révision de 2 minutes ?` : "Ta carte de France t'attend. Une petite partie ?";
      return { msg: { title: stage === 1 ? "Ça fait un moment ! 👋" : "Hexa s'ennuie sans toi 🗺️", body, url: "/", tag: "retour" }, stage };
    }
  }
  return null;
}

export async function sendTo(s: Pick<Sub, "endpoint" | "p256dh" | "auth">, msg: Message): Promise<boolean> {
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 6 * 3600, urgency: "normal" });
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    // Abonnement expiré ou révoqué : on l'oublie.
    if (code === 404 || code === 410) db.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(s.endpoint);
    else console.error("[push] envoi échoué", code ?? e);
    return false;
  }
}

async function tick() {
  if (!pushEnabled) return;
  const { day, hour } = parisNow();
  const subs = db.prepare("SELECT * FROM push_subs WHERE last_sent_day IS NULL OR last_sent_day != ?").all(day) as unknown as Sub[];
  let sent = 0;
  for (const s of subs) {
    const d = decide(s, cleanPrefs(JSON.parse(s.prefs)), day, hour);
    if (!d) continue;
    if (await sendTo(s, d.msg)) {
      sent++;
      db.prepare("UPDATE push_subs SET last_sent_day = ?, comeback_stage = COALESCE(?, comeback_stage) WHERE endpoint = ?").run(day, d.stage ?? null, s.endpoint);
    }
  }
  if (sent) console.log(`[push] ${sent} notification(s) envoyée(s)`);
}
export function startPushScheduler() {
  if (!pushEnabled) return;
  // Instance en vidange : c'est la nouvelle qui envoie les notifications.
  setInterval(() => { if (!life.draining) void tick().catch((e) => console.error("[push]", e)); }, 5 * 60_000).unref();
}
