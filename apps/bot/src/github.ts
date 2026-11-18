// Forums #bugs et #idées ↔ issues GitHub (dépôt public) : chaque nouveau fil devient une issue (texte du premier
// message, étiquettes, lien du fil, jamais le nom de la personne) ; le bot répond dans le fil avec le lien.
// Ensuite, toutes les 5 minutes : les réponses de l'équipe sur GitHub sont recopiées dans le fil, et la fermeture
// de l'issue est annoncée (étiquette « Corrigé » sur les bugs).
import { EmbedBuilder, type AnyThreadChannel, type Client, type ForumChannel } from "discord.js";
import { COLORS, config } from "./config.ts";
import { save, state } from "./state.ts";
import { issueBody } from "./text.ts";

async function gh<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`https://api.github.com/repos/${config.github.repo}${path}`, {
    method, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10_000),
    headers: { authorization: `Bearer ${config.github.token}`, accept: "application/vnd.github+json", "user-agent": "hexa-discord-bot", "content-type": "application/json" },
  });
  if (!r.ok) throw new Error(`GitHub ${method} ${path} : ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json() as Promise<T>;
}

export async function onThread(thread: AnyThreadChannel, newly: boolean) {
  if (!newly || !config.github.token || !thread.parentId || ![config.channels.bugs, config.channels.idees].includes(thread.parentId)) return;
  if (state.issues[thread.id]) return;
  const bug = thread.parentId === config.channels.bugs;
  const forum = thread.parent as ForumChannel | null;
  const tags = thread.appliedTags.map((id) => forum?.availableTags.find((t) => t.id === id)?.name).filter((x): x is string => !!x);
  // Le premier message arrive parfois juste après le fil.
  const starter = await thread.fetchStarterMessage().catch(async () => { await new Promise((r) => setTimeout(r, 2500)); return thread.fetchStarterMessage().catch(() => null); });
  const files = starter ? [...starter.attachments.values()].map((a) => `![${a.name}](${a.url})`) : [];
  const text = [starter?.content ?? "", ...files].join("\n\n");
  const body = { title: `${bug ? "[Bug]" : "[Idée]"} ${thread.name}`.slice(0, 250), body: issueBody(text, thread.url, tags), labels: [bug ? "bug" : "idée", "discord"] };
  let issue: { number: number; html_url: string };
  try { issue = await gh("POST", "/issues", body); }
  catch { issue = await gh("POST", "/issues", { ...body, labels: undefined }); } // étiquettes refusées : sans
  state.issues[thread.id] = { number: issue.number, url: issue.html_url };
  save();
  await thread.send({ embeds: [new EmbedBuilder().setColor(COLORS.ink).setDescription(`📌 Merci ! C'est noté sur GitHub : [${bug ? "bug" : "idée"} n° ${issue.number}](${issue.html_url}). Les réponses de l'équipe apparaîtront aussi ici.\n_Le dépôt est public : le texte de ce fil y est recopié, sans ton pseudo._`)] });
}

interface Comment { id: number; body: string; author_association: string; user: { login: string } }
export async function tickGithub(client: Client) {
  if (!config.github.token) return;
  for (const [threadId, it] of Object.entries(state.issues)) {
    if (it.closed) continue;
    const thread = (await client.channels.fetch(threadId).catch(() => null)) as AnyThreadChannel | null;
    if (!thread) continue;
    const comments = await gh<Comment[]>("GET", `/issues/${it.number}/comments?per_page=50`).catch(() => [] as Comment[]);
    for (const c of comments.filter((c) => c.id > (it.lastComment ?? 0) && ["OWNER", "MEMBER", "COLLABORATOR"].includes(c.author_association))) {
      await thread.send({ embeds: [new EmbedBuilder().setColor(COLORS.blue).setAuthor({ name: `Équipe Hexa (GitHub)` }).setDescription(c.body.slice(0, 3900)).setURL(`${it.url}#issuecomment-${c.id}`)] }).catch(() => {});
      it.lastComment = c.id;
    }
    const issue = await gh<{ state: string; state_reason: string | null }>("GET", `/issues/${it.number}`).catch(() => null);
    if (issue?.state === "closed") {
      const done = issue.state_reason !== "not_planned";
      await thread.send({ embeds: [new EmbedBuilder().setColor(done ? COLORS.green : COLORS.ink).setDescription(done ? `✅ Traité ! L'[issue n° ${it.number}](${it.url}) est close : ce sera dans une prochaine version (voir #nouveautés).` : `L'[issue n° ${it.number}](${it.url}) est close sans suite pour l'instant. Merci quand même pour ta proposition !`)] }).catch(() => {});
      const forum = thread.parent as ForumChannel | null;
      const fixed = forum?.availableTags.find((t) => t.name === "Corrigé");
      if (done && fixed && thread.parentId === config.channels.bugs && !thread.appliedTags.includes(fixed.id)) await thread.setAppliedTags([...thread.appliedTags, fixed.id].slice(0, 5)).catch(() => {});
      it.closed = true;
    }
    save();
  }
}
