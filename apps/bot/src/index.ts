// Bot Discord d'Hexa : défi du jour (matin et podium du soir), question du jour, nouveautés, roadmap, soirées
// publiques, forums ↔ GitHub, commandes /defi et /classement. Tourne dans son propre conteneur, à côté du jeu.
import { ApplicationCommandOptionType, Client, Events, GatewayIntentBits, type ApplicationCommandDataResolvable, type ChatInputCommandInteraction } from "discord.js";
import { config } from "./config.ts";
import { cmdClassement, cmdDefi, tickDaily } from "./daily.ts";
import { onThread, tickGithub } from "./github.ts";
import { syncNews, syncRoadmap } from "./posts.ts";
import { onAnswer, tickQuestion } from "./question.ts";
import { tickSoirees } from "./soirees.ts";
import { LEVELS, LEVEL_NAMES, type Level } from "./text.ts";

// Sans jeton, on s'arrête proprement (le conteneur n'est pas relancé en boucle).
if (!config.token) { console.error("DISCORD_TOKEN absent : bot désactivé."); process.exit(0); }
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/** Une tâche qui plante (Hexa en mise à jour, Discord lent…) ne doit jamais arrêter le bot. */
const safe = (name: string, f: () => Promise<unknown>) => () => f().catch((e) => console.error(`[${name}]`, e?.message ?? e));
const every = (ms: number, name: string, f: () => Promise<unknown>) => { const run = safe(name, f); run(); setInterval(run, ms); };

const COMMANDS: ApplicationCommandDataResolvable[] = [
  { name: "defi", description: "Le défi du jour d'Hexa : lien et nombre de joueurs", name_localizations: { fr: "défi" } },
  {
    name: "classement", description: "Le classement du défi d'Hexa (du jour ou de la semaine)",
    options: [
      { type: ApplicationCommandOptionType.String as const, name: "niveau", description: "Un seul niveau (sinon les trois)", required: false, choices: LEVELS.map((l) => ({ name: LEVEL_NAMES[l], value: l })) },
      { type: ApplicationCommandOptionType.String as const, name: "periode", name_localizations: { fr: "période" }, description: "Aujourd'hui ou toute la semaine", required: false, choices: [{ name: "Aujourd'hui", value: "jour" }, { name: "Cette semaine", value: "semaine" }] },
    ],
  },
];

client.once(Events.ClientReady, async (c) => {
  console.log(`Connecté : ${c.user.tag}`);
  const guild = await c.guilds.fetch(config.guild);
  await guild.commands.set(COMMANDS).catch((e) => console.error("[commandes]", e.message));
  await safe("nouveautés", () => syncNews(c))();
  await safe("roadmap", () => syncRoadmap(c))();
  every(60_000, "défi", () => tickDaily(c));
  every(60_000, "question", () => tickQuestion(c));
  every(15_000, "soirées", () => tickSoirees(c));
  every(5 * 60_000, "github", () => tickGithub(c));
});

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isButton() && i.customId.startsWith("q:")) return await onAnswer(i);
    if (!i.isChatInputCommand()) return;
    await (i as ChatInputCommandInteraction).deferReply();
    if (i.commandName === "defi") return void (await i.editReply(await cmdDefi()));
    if (i.commandName === "classement") {
      const level = (i.options.getString("niveau") as Level | null) ?? null;
      const periode = i.options.getString("periode") === "semaine" ? "semaine" : "jour";
      return void (await i.editReply(await cmdClassement(level, periode)));
    }
  } catch (e) {
    console.error("[interaction]", (e as Error).message);
    if (i.isRepliable()) await (i.deferred ? i.editReply("Hexa ne répond pas pour l'instant, réessaie dans une minute.") : i.reply({ content: "Oups, réessaie dans une minute.", ephemeral: true })).catch(() => {});
  }
});
client.on(Events.ThreadCreate, (t, newly) => void safe("github", () => onThread(t, newly))());

process.on("SIGTERM", () => { client.destroy(); process.exit(0); });
client.login(config.token);
