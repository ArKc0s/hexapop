// Studio Hexa : fabrique chaque nuit le reel du jour, le soumet à validation sur Discord (#studio),
// puis le publie au bon créneau. Tourne sur la machine hexa-studio (voir docs/studio.md).
//   node src/index.ts daemon                       le service (systemd)
//   node src/index.ts make <format> [voix] [graine] un essai, sans Discord (formats : voir ROTATION)
//   node src/index.ts ig-token <jeton>             enregistre le jeton Instagram
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Discord, NO, OK, REDO } from "./discord.ts";
import { ROTATION, plan, seeded, type FormatId } from "./formats.ts";
import { publishReel, refresh, type IgAuth } from "./instagram.ts";
import { make } from "./render.ts";
import type { VoiceName } from "./voice.ts";

const env = (k: string, d = "") => process.env[k] ?? d;
const DATA = env("STUDIO_DATA", join(process.env.HOME ?? ".", "studio", "data"));
const CFG = {
  eleven: env("ELEVEN_KEY"), discord: env("DISCORD_TOKEN"), guild: env("DISCORD_GUILD", "1572549750555680860"),
  hexa: env("HEXA_URL", "https://hexapop.app"), stats: env("STATS_TOKEN"),
  genHour: Number(env("GEN_HOUR", "3")), slotWeek: env("SLOT_WEEK", "18:30"), slotWeekend: env("SLOT_WEEKEND", "11:00"), maxRedo: 3,
};
const NAMES: Record<FormatId, string> = { placer: "Tu sais placer ces départements ?", numero: "Le numéro mystère", prefecture: "Préfecture ou pas ?", vraifaux: "Vrai ou faux ?", rates: "Les plus ratés sur Hexa" };

type Status = "attente" | "valide" | "refuse" | "refait" | "publie" | "echec";
interface Reel { id: string; day: string; format: FormatId; voice: VoiceName; dir: string; caption: string; status: Status; msg?: string; createdAt: number; validatedAt?: number; publishedAt?: number; igLink?: string }
interface State { channel?: string; owner?: string; rot: number; voiceNext: VoiceName; used: Partial<Record<FormatId, string[]>>; reels: Reel[]; ig?: IgAuth; chars: Record<string, number>; cleaned?: string }

mkdirSync(DATA, { recursive: true });
const STATE = join(DATA, "state.json");
const load = (): State => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { rot: 0, voiceNext: "hugo", used: {}, reels: [], chars: {} });
const save = (s: State) => writeFileSync(STATE, JSON.stringify(s, null, 1));
const log = (...a: unknown[]) => console.log(new Date().toLocaleString("fr-FR"), ...a);
const dayOf = (d = new Date()) => d.toLocaleDateString("sv-SE"); // AAAA-MM-JJ, heure de Paris (fuseau de la machine)
const hm = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const slotOf = (d = new Date()) => (d.getDay() === 0 || d.getDay() === 6 ? CFG.slotWeekend : CFG.slotWeek);

async function rates(): Promise<{ code: string; rate: number; seen: number }[] | undefined> {
  if (!CFG.stats) return undefined;
  try {
    const r = await fetch(CFG.hexa + "/api/admin/rates", { headers: { authorization: "Bearer " + CFG.stats }, signal: AbortSignal.timeout(20_000) });
    return r.ok ? ((await r.json()) as { rates: { code: string; rate: number; seen: number }[] }).rates : undefined;
  } catch { return undefined; }
}

/** Fabrique un reel (format imposé ou suivant de la rotation). */
async function produce(s: State, o: { format?: FormatId; voice?: VoiceName; seed: string; dir: string }) {
  const r = await rates();
  let format = o.format, p = null;
  for (let i = 0; i < ROTATION.length && !p; i++) {
    const f = format ?? ROTATION[(s.rot + i) % ROTATION.length];
    p = plan(f, { rng: seeded(o.seed + ":" + f), recent: new Set(s.used[f] ?? []), rates: r });
    if (!p && format) throw new Error(`format « ${format} » indisponible (statistiques ?)`);
    if (p && !format) s.rot = (s.rot + i + 1) % ROTATION.length;
    format = format ?? (p ? f : undefined);
  }
  if (!p) throw new Error("aucun format disponible");
  const voice = o.voice ?? s.voiceNext;
  const made = await make(p, voice, o.dir, { elevenKey: CFG.eleven, cache: join(DATA, "voix"), log });
  const month = dayOf().slice(0, 7); s.chars[month] = (s.chars[month] ?? 0) + made.chars;
  return { p, voice, made };
}

// ---------- essai à la main ----------
async function essai(format: FormatId, voice: VoiceName = "hugo", seed = String(Date.now())) {
  const s = load(), dir = join(DATA, "essais", `${format}-${voice}-${seed}`);
  const { p, made } = await produce(s, { format, voice, seed, dir });
  writeFileSync(join(dir, "legende.txt"), p.caption);
  save({ ...load(), chars: s.chars });
  log(`fini : ${made.mp4} (${made.dur} s)\n${made.script.join("\n")}`);
}

// ---------- le service ----------
async function tick(dc: Discord) {
  const s = load(), now = new Date(), day = dayOf(now), mins = now.getHours() * 60 + now.getMinutes();
  s.owner ??= await dc.owner();
  s.channel = await dc.studioChannel(s.channel);
  const ping = `<@${s.owner}>`;
  const link = (r: Reel) => `https://discord.com/channels/${dc.guild}/${s.channel}/${r.msg}`;

  const newReel = async (seedExtra = "") => {
    const id = day + (seedExtra ? "-" + seedExtra : ""), dir = join(DATA, "reels", id);
    try {
      const { p, voice, made } = await produce(s, { seed: id, dir });
      const r: Reel = { id, day, format: p.format, voice, dir, caption: p.caption, status: "attente", createdAt: Date.now() };
      const hours = slotOf(now);
      r.msg = await dc.send(s.channel!, [
        `🎬 **Reel du ${new Date(day).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}** · ${NAMES[p.format]} · voix ${voice === "hugo" ? "Hugo" : "Camille"} · ${made.dur} s`,
        `${OK} publier (créneau de ${hours}) · ${NO} l'écarter · ${REDO} en refaire un autre`,
        "", "Légende :", "```", p.caption, "```",
      ].join("\n"), [made.mp4]);
      for (const e of [OK, NO, REDO]) await dc.react(s.channel!, r.msg, e);
      s.reels.push(r);
      s.used[p.format] = [...p.used, ...(s.used[p.format] ?? [])].slice(0, 40);
      s.voiceNext = voice === "hugo" ? "camille" : "hugo";
      log("reel prêt :", id, p.format, voice);
    } catch (e) {
      s.reels.push({ id, day, format: "placer", voice: s.voiceNext, dir, caption: "", status: "echec", createdAt: Date.now() });
      log("échec :", e);
      await dc.send(s.channel!, `⚠️ ${ping} Le reel ${id} n'a pas pu être fabriqué : ${String((e as Error).message ?? e).slice(0, 300)}`);
    }
  };

  // 1. La nuit : le reel du jour.
  if (now.getHours() >= CFG.genHour && !s.reels.some((r) => r.day === day)) { await newReel(); save(s); }

  // 2. Les réactions sur les reels en attente.
  for (const r of s.reels.filter((x) => x.status === "attente" && x.msg)) {
    const by = async (e: string) => (await dc.reactors(s.channel!, r.msg!, e)).includes(s.owner!);
    if (await by(OK)) {
      r.status = "valide"; r.validatedAt = Date.now();
      const late = mins >= hm("23:00");
      await dc.send(s.channel!, `${OK} Validé : publication ${late ? "demain" : mins >= hm(slotOf(now)) ? "maintenant" : "à " + slotOf(now)}.`);
    } else if (await by(NO)) {
      r.status = "refuse"; await dc.send(s.channel!, `${NO} Écarté. Rien ne sera publié pour ce reel.`);
    } else if (await by(REDO)) {
      r.status = "refait";
      const n = s.reels.filter((x) => x.day === r.day).length;
      if (n > CFG.maxRedo) await dc.send(s.channel!, `${REDO} Déjà ${n} essais aujourd'hui : on s'arrête là, rendez-vous demain.`);
      else { await dc.send(s.channel!, `${REDO} C'est parti pour un autre, quelques minutes…`); save(s); await newReel(String(n)); }
    }
    save(s);
  }

  // 3. Le créneau : un reel validé par jour, entre le créneau et 23 h.
  const due = s.reels.filter((r) => r.status === "valide").sort((a, b) => a.createdAt - b.createdAt)[0];
  const publishedToday = s.reels.some((r) => r.status === "publie" && r.publishedAt && dayOf(new Date(r.publishedAt)) === day);
  if (due && !publishedToday && mins >= hm(slotOf(now)) && mins < hm("23:00")) {
    let ig = "";
    if (s.ig) {
      try { s.ig = await refresh(s.ig); due.igLink = await publishReel(s.ig, join(due.dir, "reel.mp4"), due.caption, 1.6); ig = `📸 Publié sur Instagram : ${due.igLink}\n`; }
      catch (e) { ig = `⚠️ Instagram : échec (${String((e as Error).message).slice(0, 200)}). À publier à la main.\n`; log("instagram :", e); }
    }
    due.status = "publie"; due.publishedAt = Date.now();
    await dc.send(s.channel!, `⏰ ${ping} C'est l'heure !\n${ig}${s.ig && due.igLink ? "" : "📸 Instagram : à publier à la main.\n"}🎵 TikTok : enregistre la vidéo (${link(due)}) et publie-la avec la légende ci-dessous (ajoute un son tendance si tu veux).\n\`\`\`\n${due.caption}\n\`\`\``);
    save(s);
  }

  // 4. Ménage une fois par jour : vidéos de plus de 30 jours, voix pas réutilisées depuis 90 jours.
  if (s.cleaned !== day) {
    for (const [sub, days] of [["reels", 30], ["essais", 14], ["voix", 90]] as const) {
      const d = join(DATA, sub); if (!existsSync(d)) continue;
      for (const f of readdirSync(d)) { const p = join(d, f); if (Date.now() - statSync(p).mtimeMs > days * 86_400_000) rmSync(p, { recursive: true, force: true }); }
    }
    s.reels = s.reels.filter((r) => Date.now() - r.createdAt < 60 * 86_400_000);
    s.cleaned = day; save(s);
  }
}

async function daemon() {
  for (const k of ["eleven", "discord"] as const) if (!CFG[k]) throw new Error(`variable manquante : ${k === "eleven" ? "ELEVEN_KEY" : "DISCORD_TOKEN"}`);
  const dc = new Discord(CFG.discord, CFG.guild);
  log("studio démarré ; reel du jour à", CFG.genHour + " h, créneaux", CFG.slotWeek, "/", CFG.slotWeekend, "(week-end)");
  let busy = false;
  const run = async () => { if (busy) return; busy = true; try { await tick(dc); } catch (e) { log("erreur :", e); } finally { busy = false; } };
  await run(); setInterval(run, 60_000);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "daemon") await daemon();
else if (cmd === "make") await essai(args[0] as FormatId, (args[1] as VoiceName) ?? "hugo", args[2]);
else if (cmd === "ig-token") { const s = load(); s.ig = await refresh({ token: args[0], refreshedAt: Date.now() }); save(s); log("Instagram relié :", s.ig.username); }
else { console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(0, 6).join("\n")); process.exit(1); }
