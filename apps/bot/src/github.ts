// Forums #bugs / #idées ↔ issues GitHub (dépôt public), dans les deux sens :
// - un nouveau fil devient une issue (texte du premier message, pièces jointes, étiquettes, lien du fil, jamais le pseudo) ;
// - une issue ouverte sur GitHub devient un fil (#bugs si étiquette « bug », sinon #idées) ;
// - les messages d'un fil deviennent des commentaires de l'issue, et les commentaires GitHub reviennent dans le fil ;
// - fermeture et réouverture de l'issue sont annoncées dans le fil (étiquette « Corrigé » sur les bugs).
// Chaque recopie porte une marque invisible pour ne jamais être renvoyée dans l'autre sens.
import { EmbedBuilder, type AnyThreadChannel, type Client, type ForumChannel, type Message } from "discord.js";
import { COLORS, config } from "./config.ts";
import { save, state } from "./state.ts";
import { issueBody } from "./text.ts";

const MARK = "<!-- hexa-discord -->";
const TEAM = ["OWNER", "MEMBER", "COLLABORATOR"];

async function gh<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`https://api.github.com/repos/${config.github.repo}${path}`, {
    method, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10_000),
    headers: { authorization: `Bearer ${config.github.token}`, accept: "application/vnd.github+json", "user-agent": "hexa-discord-bot", "content-type": "application/json" },
  });
  if (!r.ok) throw new Error(`GitHub ${method} ${path} : ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json() as Promise<T>;
}

const isForum = (id: string | null) => !!id && [config.channels.bugs, config.channels.idees].includes(id);
const attachments = (m: Message) => [...m.attachments.values()].map((a) => (a.contentType?.startsWith("image/") ? `![${a.name}](${a.url})` : `[${a.name}](${a.url})`));

// ---------- Discord → GitHub ----------
export async function onThread(thread: AnyThreadChannel, newly: boolean) {
  if (!newly || !config.github.token || !isForum(thread.parentId) || state.issues[thread.id]) return;
  if (thread.ownerId === thread.client.user?.id) return; // fil ouvert par le bot depuis une issue GitHub
  const bug = thread.parentId === config.channels.bugs;
  const forum = thread.parent as ForumChannel | null;
  const tags = thread.appliedTags.map((id) => forum?.availableTags.find((t) => t.id === id)?.name).filter((x): x is string => !!x);
  // Le premier message arrive parfois juste après le fil.
  const starter = await thread.fetchStarterMessage().catch(async () => { await new Promise((r) => setTimeout(r, 2500)); return thread.fetchStarterMessage().catch(() => null); });
  const text = [starter?.content ?? "", ...(starter ? attachments(starter) : [])].join("\n\n");
  const body = { title: `${bug ? "[Bug]" : "[Idée]"} ${thread.name}`.slice(0, 250), body: `${issueBody(text, thread.url, tags)}\n${MARK}`, labels: [bug ? "bug" : "idée", "discord"] };
  let issue: { number: number; html_url: string };
  try { issue = await gh("POST", "/issues", body); }
  catch { issue = await gh("POST", "/issues", { ...body, labels: undefined }); } // étiquettes refusées : sans
  state.issues[thread.id] = { number: issue.number, url: issue.html_url, starter: starter?.id };
  save();
  await thread.send({ embeds: [new EmbedBuilder().setColor(COLORS.ink).setDescription(`📌 Merci ! C'est noté sur GitHub : [${bug ? "bug" : "idée"} n° ${issue.number}](${issue.html_url}). La conversation est synchronisée dans les deux sens : ce que tu écris ici y est recopié, et les réponses reviennent ici.\n_Le dépôt est public : les messages de ce fil y sont recopiés, sans ton pseudo._`)] });
}

/** Un message dans un fil suivi : il devient un commentaire de l'issue (sans pseudo). */
export async function onMessage(m: Message) {
  if (m.author.bot || m.system || !config.github.token || !m.channel.isThread()) return;
  const it = state.issues[m.channel.id];
  if (!it || m.id === it.starter || m.id === m.channel.id) return; // le premier message est déjà le corps de l'issue
  const text = [m.content, ...attachments(m)].filter(Boolean).join("\n\n");
  if (!text.trim()) return;
  const quoted = text.split("\n").map((l) => `> ${l}`).join("\n");
  await gh("POST", `/issues/${it.number}/comments`, { body: `**Sur Discord** :\n\n${quoted}\n\n${MARK}` });
}

// ---------- GitHub → Discord ----------
interface Comment { id: number; body: string; author_association: string; user: { login: string; type: string } }
interface Issue { number: number; title: string; body: string | null; html_url: string; state: string; state_reason: string | null; labels: { name: string }[]; pull_request?: unknown; created_at: string }

/** Les issues ouvertes sur GitHub après la mise en route deviennent des fils. */
async function importIssues(client: Client) {
  state.ghSince ??= new Date().toISOString();
  const issues = await gh<Issue[]>("GET", `/issues?state=open&sort=created&direction=asc&since=${state.ghSince}&per_page=30`);
  const known = new Set(Object.values(state.issues).map((x) => x.number));
  for (const i of issues) {
    if (i.pull_request || known.has(i.number) || (i.body ?? "").includes(MARK) || i.created_at < state.ghSince) continue;
    const bug = i.labels.some((l) => l.name === "bug");
    const forum = (await client.channels.fetch(bug ? config.channels.bugs : config.channels.idees)) as ForumChannel;
    const title = i.title.replace(/^\[(bug|idée|idee)\]\s*/i, "").slice(0, 100) || `Issue n° ${i.number}`;
    const tag = forum.availableTags.find((t) => (bug ? false : t.name === "Autre"));
    const desc = (i.body ?? "").trim().slice(0, 1500) || "_(pas de description)_";
    const thread = await forum.threads.create({
      name: title, appliedTags: tag ? [tag.id] : [],
      message: { embeds: [new EmbedBuilder().setColor(COLORS.ink).setTitle(`${bug ? "🐞" : "💡"} Ouvert sur GitHub : n° ${i.number}`).setURL(i.html_url).setDescription(desc)] },
    });
    state.issues[thread.id] = { number: i.number, url: i.html_url, starter: thread.id };
    known.add(i.number);
    save();
  }
}

export async function tickGithub(client: Client) {
  if (!config.github.token) return;
  await importIssues(client).catch((e) => console.error("[github import]", (e as Error).message));
  for (const [threadId, it] of Object.entries(state.issues)) {
    const thread = (await client.channels.fetch(threadId).catch(() => null)) as AnyThreadChannel | null;
    if (!thread) continue;
    const comments = await gh<Comment[]>("GET", `/issues/${it.number}/comments?per_page=100`).catch(() => [] as Comment[]);
    for (const c of comments.filter((c) => c.id > (it.lastComment ?? 0))) {
      it.lastComment = c.id;
      if (c.body.includes(MARK)) continue; // recopié depuis Discord
      if (thread.archived) await thread.setArchived(false).catch(() => {});
      const who = TEAM.includes(c.author_association) ? "Équipe Hexa (GitHub)" : `${c.user.login} (GitHub)`;
      await thread.send({ embeds: [new EmbedBuilder().setColor(TEAM.includes(c.author_association) ? COLORS.blue : COLORS.ink).setAuthor({ name: who }).setDescription(c.body.slice(0, 3900)).setURL(`${it.url}#issuecomment-${c.id}`)] }).catch(() => {});
    }
    const issue = await gh<Issue>("GET", `/issues/${it.number}`).catch(() => null);
    if (issue?.state === "closed" && !it.closed) {
      const done = issue.state_reason !== "not_planned";
      await thread.send({ embeds: [new EmbedBuilder().setColor(done ? COLORS.green : COLORS.ink).setDescription(done ? `✅ Traité ! L'[issue n° ${it.number}](${it.url}) est close : ce sera dans une prochaine version (voir #nouveautés).` : `L'[issue n° ${it.number}](${it.url}) est close sans suite pour l'instant. Merci quand même !`)] }).catch(() => {});
      const forum = thread.parent as ForumChannel | null;
      const fixed = forum?.availableTags.find((t) => t.name === "Corrigé");
      if (done && fixed && thread.parentId === config.channels.bugs && !thread.appliedTags.includes(fixed.id)) await thread.setAppliedTags([...thread.appliedTags, fixed.id].slice(0, 5)).catch(() => {});
      it.closed = true;
    } else if (issue?.state === "open" && it.closed) {
      await thread.send({ embeds: [new EmbedBuilder().setColor(COLORS.yellow).setDescription(`🔄 L'[issue n° ${it.number}](${it.url}) est rouverte.`)] }).catch(() => {});
      it.closed = false;
    }
    save();
  }
}
