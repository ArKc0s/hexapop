// Soirées publiques : un admin ouvre une soirée plateau publique sur hexapop.app, le bot l'annonce dans #entre-amis
// (mention du rôle Soirées Entre amis, au plus une fois par heure), et la réannonce à chaque nouvelle partie quand
// l'hôte relance en boucle. Son statut affiche le lien tant qu'une soirée est ouverte.
import { ActivityType, EmbedBuilder, type Client, type TextChannel } from "discord.js";
import { COLORS, config } from "./config.ts";
import { publicRooms, type PublicRoom } from "./hexa.ts";
import { save, state } from "./state.ts";

const link = (code: string) => `${config.site}/#salon=${code}`;
const PING_EVERY = 3_600_000;

function card(r: PublicRoom, again: boolean) {
  const open = r.phase === "lobby";
  return new EmbedBuilder().setColor(open ? COLORS.pink : COLORS.ink).setURL(link(r.code))
    .setTitle(open ? (again ? `🎮 Nouvelle partie dans la soirée de ${r.host} !` : `🎉 Soirée publique ouverte par ${r.host} !`) : `🎮 Soirée de ${r.host} : partie en cours`)
    .setDescription(open
      ? `**[Rejoindre la partie](${link(r.code)})** · code **${r.code}**\n${r.players} joueur${r.players > 1 ? "s" : ""} dans la salle d'attente, ${r.rounds} tours. Ça démarre bientôt !`
      : `Tour ${Math.max(1, r.round)}/${r.rounds} · ${r.players} joueur${r.players > 1 ? "s" : ""}. [Regarde en spectateur](${link(r.code)}) et joue la prochaine : le salon est réannoncé à chaque nouvelle partie.`)
    .setFooter({ text: "Soirée publique Hexa · hexapop.app" });
}

let lastStatus = "";
function status(client: Client, rooms: PublicRoom[]) {
  const r = rooms.find((x) => x.phase === "lobby") ?? rooms[0];
  const text = r ? `🎮 Soirée publique : ${link(r.code).replace("https://", "")}` : "🗺️ Apprends la France en jouant · hexapop.app";
  if (text === lastStatus) return;
  lastStatus = text;
  client.user?.setPresence({ activities: [{ type: ActivityType.Custom, name: "Hexa", state: text }], status: "online" });
}

export async function tickSoirees(client: Client) {
  let rooms: PublicRoom[];
  try { rooms = await publicRooms(); } catch { return; } // Hexa en cours de mise à jour : on réessaie au prochain tour
  status(client, rooms);
  const ch = (await client.channels.fetch(config.channels.amis)) as TextChannel;
  for (const r of rooms) {
    const known = state.soirees[r.code];
    if (known && known.phase === r.phase) continue;
    const backToLobby = !!known && r.phase === "lobby" && known.phase !== "lobby";
    if (!known || backToLobby) {
      // Nouvelle soirée ou nouvelle partie : un nouveau message (la mention au plus une fois par heure).
      const ping = !known || Date.now() - known.pinged > PING_EVERY;
      const m = await ch.send({ content: ping ? `<@&${config.roles.soiree}>` : undefined, embeds: [card(r, backToLobby)], allowedMentions: { roles: ping ? [config.roles.soiree] : [] } });
      state.soirees[r.code] = { message: m.id, phase: r.phase, pinged: ping ? Date.now() : known!.pinged };
    } else {
      // La partie démarre ou avance : on met à jour l'annonce.
      const m = await ch.messages.fetch(known.message).catch(() => null);
      if (m) await m.edit({ embeds: [card(r, false)] }).catch(() => {});
      known.phase = r.phase;
    }
    save();
  }
  // Soirées terminées (salon fermé) : l'annonce le dit.
  for (const [code, s] of Object.entries(state.soirees)) {
    if (rooms.some((r) => r.code === code)) continue;
    const m = await ch.messages.fetch(s.message).catch(() => null);
    if (m) await m.edit({ content: "", embeds: [new EmbedBuilder().setColor(COLORS.ink).setTitle("Soirée terminée, merci à tous !").setDescription(`La prochaine sera annoncée ici. En attendant : ${config.site}`)] }).catch(() => {});
    delete state.soirees[code]; save();
  }
}
