// Nouveautés et roadmap : le bot reprend ce qui est déjà écrit dans le dépôt, à chaque démarrage (donc à chaque mise
// en ligne) : les entrées de la page Nouveautés du jeu, et docs/roadmap-publique.md (épinglée dans #roadmap).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { EmbedBuilder, type Client, type TextChannel } from "discord.js";
import { NEWS } from "../../web/src/lib/news.ts";
import { COLORS, config } from "./config.ts";
import { save, state } from "./state.ts";

export async function syncNews(client: Client) {
  const latest = NEWS[0];
  if (!latest) return;
  // Premier lancement : seule la dernière version est publiée (pas tout l'historique).
  if (state.newsId === undefined) state.newsId = latest.id - 1;
  const fresh = NEWS.filter((n) => n.id > state.newsId!).sort((a, b) => a.id - b.id);
  if (!fresh.length) return;
  const ch = (await client.channels.fetch(config.channels.nouveautes)) as TextChannel;
  for (const n of fresh) {
    const e = new EmbedBuilder().setColor(COLORS.pink).setTitle(`✨ Hexa ${n.version} : ${n.title}`).setURL(`${config.site}/#nouveautes`)
      .setDescription(n.items.map((x) => `• ${x}`).join("\n").slice(0, 4000)).setFooter({ text: new Date(`${n.date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) });
    const m = await ch.send({ embeds: [e] });
    await m.crosspost().catch(() => {});
    state.newsId = n.id; save();
  }
}

/** Roadmap publique : un message épinglé, réécrit quand le fichier change. Sections « ## Titre » → un encart chacune. */
export async function syncRoadmap(client: Client) {
  let md: string;
  try { md = readFileSync(new URL("../../../docs/roadmap-publique.md", import.meta.url), "utf8"); } catch { return; }
  const hash = createHash("sha256").update(md).digest("hex").slice(0, 16);
  if (state.roadmap?.hash === hash) return;
  const parts = md.split(/^## /m).slice(1);
  const colors = [COLORS.green, COLORS.yellow, COLORS.blue, COLORS.pink];
  const embeds = parts.slice(0, 10).map((p, i) => {
    const [title, ...body] = p.split("\n");
    return new EmbedBuilder().setColor(colors[i % colors.length]).setTitle(title.trim()).setDescription(body.join("\n").trim().slice(0, 4000) || "​");
  });
  embeds[embeds.length - 1]?.setFooter({ text: "Feuille de route officielle d'Hexa · mise à jour automatiquement" }).setTimestamp(new Date());
  const ch = (await client.channels.fetch(config.channels.roadmap)) as TextChannel;
  const old = state.roadmap ? await ch.messages.fetch(state.roadmap.message).catch(() => null) : null;
  if (old) await old.edit({ content: "", embeds });
  else {
    const m = await ch.send({ embeds });
    await m.pin().catch(() => {});
    state.roadmap = { message: m.id, hash };
  }
  state.roadmap!.hash = hash; save();
}
