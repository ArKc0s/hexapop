// Le défi du jour sur Discord : annonce du matin (avec le podium d'hier), podium du soir, commandes /defi et /classement.
import { EmbedBuilder, type Client, type TextChannel } from "discord.js";
import { COLORS, config } from "./config.ts";
import { board, daily, hof } from "./hexa.ts";
import { save, state } from "./state.ts";
import { LEVEL_NAMES, LEVELS, paris, podiumFields, podiumLines, yesterday, type Level } from "./text.ts";

const allBoards = (day?: string) => Promise.all(LEVELS.map((l) => board(l, day)));

/** Message du matin : le nouveau défi, le lien, et le podium d'hier par niveau. */
export async function defiEmbed(withYesterday = true) {
  const d = await daily();
  const e = new EmbedBuilder().setColor(COLORS.yellow).setTitle(`🎯 Le défi n° ${d.number} est arrivé !`).setURL(`${config.site}/#defi`)
    .setDescription(`Les mêmes questions pour tout le monde, **un seul essai**, à ton niveau.\n👉 **[Jouer le défi du jour](${config.site}/#defi)**, puis partage ton lien dans <#${config.channels.scores}>.`);
  if (withYesterday) {
    const y = await allBoards(yesterday(d.day));
    if (y.some((b) => b.top.length)) e.addFields({ name: `Podium d'hier · défi n° ${d.number - 1}`, value: "​" }, ...podiumFields(y));
  }
  return { embed: e, day: d };
}

/** Podium du soir : le défi n'est pas fini (minuit), il reste du temps pour détrôner les premiers. */
async function podiumEmbed() {
  const d = await daily();
  const b = await allBoards();
  const total = b.reduce((n, x) => n + (x.counts[x.level] ?? 0), 0);
  return new EmbedBuilder().setColor(COLORS.pink).setTitle(`🏆 Défi n° ${d.number} : le podium à 21 h`).setURL(`${config.site}/#defi`)
    .setDescription(`${total} joueur${total > 1 ? "s" : ""} aujourd'hui. Il reste jusqu'à minuit pour [faire mieux](${config.site}/#defi) !`)
    .addFields(...podiumFields(b));
}

/** Appelé chaque minute : publie ce qui est dû (une fois par jour, même après un redémarrage). */
export async function tickDaily(client: Client) {
  const now = paris();
  const ch = (await client.channels.fetch(config.channels.defi)) as TextChannel;
  if (now.hour >= config.at.defi && state.defiPosted !== now.day) {
    const { embed } = await defiEmbed();
    const m = await ch.send({ content: `<@&${config.roles.defi}>`, embeds: [embed], allowedMentions: { roles: [config.roles.defi] } });
    if ("crosspost" in m) await m.crosspost().catch(() => {}); // salon d'annonces : visible aussi chez les serveurs abonnés
    state.defiPosted = now.day; save();
  }
  if (now.hour >= config.at.podium && state.podiumPosted !== now.day && state.defiPosted === now.day) {
    await ch.send({ embeds: [await podiumEmbed()] });
    state.podiumPosted = now.day; save();
  }
}

// ---------- commandes ----------
export async function cmdDefi() {
  const { embed } = await defiEmbed(false);
  const b = await allBoards();
  const total = b.reduce((n, x) => n + (x.counts[x.level] ?? 0), 0);
  embed.setTitle(embed.data.title!.replace(" est arrivé !", "")).addFields({ name: "Aujourd'hui", value: `${total} joueur${total > 1 ? "s" : ""} pour l'instant · fin à minuit` });
  return { embeds: [embed] };
}
export async function cmdClassement(level: Level | null, periode: "jour" | "semaine") {
  const levels = level ? [level] : [...LEVELS];
  if (periode === "semaine") {
    const h = await hof();
    const e = new EmbedBuilder().setColor(COLORS.blue).setTitle("🏆 Défis de la semaine").setURL(`${config.site}/#hall-of-fame`)
      .setDescription(`Points cumulés depuis lundi (${h.daily.since.week}), comptes seulement.`);
    for (const l of levels) {
      const rows = h.daily.week[l] ?? [];
      e.addFields({ name: LEVEL_NAMES[l], value: rows.length ? rows.slice(0, 5).map((r, i) => `${["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} **${r.name}** · ${r.points.toLocaleString("fr-FR").replace(/ | /g, " ")} pts (${r.days} j)`).join("\n") : "_personne pour l'instant_" });
    }
    return { embeds: [e] };
  }
  const d = await daily();
  const b = await Promise.all(levels.map((l) => board(l)));
  const e = new EmbedBuilder().setColor(COLORS.blue).setTitle(`🏆 Défi n° ${d.number} : classement du jour`).setURL(`${config.site}/#defi`);
  for (const x of b) {
    const n = x.counts[x.level] ?? 0;
    e.addFields({ name: `${LEVEL_NAMES[x.level]} · ${n} joueur${n > 1 ? "s" : ""}`, value: podiumLines(x.top, level ? 10 : 3) });
  }
  return { embeds: [e] };
}
