// Question du jour dans #général : une question Hexa, 4 boutons, une seule réponse par personne (réponse privée),
// le compteur et le premier à trouver affichés sur le message. Le lendemain, la réponse est dévoilée.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type ButtonInteraction, type Client, type TextChannel } from "discord.js";
import { COLORS, config } from "./config.ts";
import { save, state, type Question } from "./state.ts";
import { paris, questionOf } from "./text.ts";

function view(q: Question, closed = false) {
  const n = Object.keys(q.answers).length, ok = Object.values(q.answers).filter((a) => a.ok).length;
  const e = new EmbedBuilder().setColor(closed ? COLORS.green : COLORS.blue).setTitle(`❓ Question du jour`).setDescription(`**${q.question}**`)
    .setFooter({ text: closed ? "Question terminée" : "Une seule réponse par personne · réponse dévoilée demain" });
  e.addFields({ name: "Réponses", value: n ? `${n} réponse${n > 1 ? "s" : ""} · ${ok} bonne${ok > 1 ? "s" : ""}${q.first ? ` · premier à trouver : <@${q.first}>` : ""}` : "Sois le premier !" });
  if (closed) e.addFields({ name: "La réponse", value: `✅ **${q.answer}**\n${questionOf(q.day).detail}\n[Réviser sur Hexa](${config.site}/#entrainement)` });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(q.options.map((o, i) =>
    new ButtonBuilder().setCustomId(`q:${q.day}:${i}`).setLabel(o.slice(0, 80)).setDisabled(closed)
      .setStyle(closed ? (o === q.answer ? ButtonStyle.Success : ButtonStyle.Secondary) : ButtonStyle.Primary)));
  return { embeds: [e], components: [row], allowedMentions: { parse: [] as never[] } };
}

/** Chaque minute : à midi, clôt la question de la veille et pose la nouvelle. */
export async function tickQuestion(client: Client) {
  const now = paris();
  if (now.hour < config.at.question || state.question?.day === now.day) return;
  const ch = (await client.channels.fetch(config.channels.general)) as TextChannel;
  const prev = state.question;
  if (prev) {
    const m = await ch.messages.fetch(prev.message).catch(() => null);
    if (m) await m.edit(view(prev, true)).catch(() => {});
  }
  const d = questionOf(now.day);
  const q: Question = { day: now.day, channel: ch.id, message: "", question: d.question, answer: d.answer, options: d.options, answers: {} };
  const m = await ch.send(view(q));
  q.message = m.id; state.question = q; save();
}

export async function onAnswer(i: ButtonInteraction) {
  const [, day, idx] = i.customId.split(":");
  const q = state.question;
  if (!q || q.day !== day) return i.reply({ content: "Cette question est terminée : la nouvelle arrive chaque jour à midi.", ephemeral: true });
  if (q.answers[i.user.id]) return i.reply({ content: `Tu as déjà répondu (${q.answers[i.user.id].ok ? "juste ✅" : "faux ❌"}). La réponse est dévoilée demain à midi.`, ephemeral: true });
  const choice = q.options[Number(idx)];
  const ok = choice === q.answer;
  q.answers[i.user.id] = { ok, at: Date.now() };
  if (ok && !q.first) q.first = i.user.id;
  save();
  await i.reply({ content: ok ? `✅ Bonne réponse ! ${questionOf(q.day).detail}` : `❌ Raté ! Ce n'était pas ${choice}. La réponse est dévoilée demain à midi ; en attendant, [révise sur Hexa](${config.site}/#entrainement).`, ephemeral: true });
  await i.message.edit(view(q)).catch(() => {});
}
