// Discord (API REST, avec le jeton du bot Hexa) : salon privé #studio, envoi des reels à valider,
// lecture des réactions. Pas de connexion permanente : le bot principal (apps/bot) garde la sienne.
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const API = "https://discord.com/api/v10";
export const OK = "✅", NO = "❌", REDO = "🔁";

export class Discord {
  private token: string;
  readonly guild: string;
  constructor(token: string, guild: string) { this.token = token; this.guild = guild; }

  async call<T = unknown>(method: string, path: string, body?: unknown, form?: FormData): Promise<T> {
    for (let i = 0; i < 4; i++) {
      const res = await fetch(API + path, {
        method, body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
        headers: { authorization: `Bot ${this.token}`, ...(body !== undefined && !form ? { "content-type": "application/json" } : {}) },
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status === 429) { const r = (await res.json()) as { retry_after?: number }; await sleep(((r.retry_after ?? 1) + 0.2) * 1000); continue; }
      if (res.status >= 500) { await sleep(3000 * (i + 1)); continue; }
      if (!res.ok) throw new Error(`Discord ${method} ${path} : ${res.status} ${(await res.text()).slice(0, 300)}`);
      return (res.status === 204 ? undefined : await res.json()) as T;
    }
    throw new Error(`Discord ${method} ${path} : trop d'essais`);
  }

  /** Le propriétaire du serveur (celui qui valide les reels). */
  async owner(): Promise<string> { return (await this.call<{ owner_id: string }>("GET", `/guilds/${this.guild}`)).owner_id; }

  /** Salon privé #studio : visible seulement par le propriétaire et le bot. */
  async studioChannel(known?: string): Promise<string> {
    if (known) { try { await this.call("GET", `/channels/${known}`); return known; } catch { /* supprimé : on le recrée */ } }
    const me = await this.call<{ id: string }>("GET", "/users/@me"), owner = await this.owner();
    const VIEW = 1n << 10n, SEND = 1n << 11n, HISTORY = 1n << 16n, FILES = 1n << 15n, REACT = 1n << 6n, EMBED = 1n << 14n;
    const all = String(VIEW | SEND | HISTORY | FILES | REACT | EMBED);
    const ch = await this.call<{ id: string }>("POST", `/guilds/${this.guild}/channels`, {
      name: "studio", type: 0, topic: "Reels d'Hexa à valider : ✅ publier · ❌ écarter · 🔁 en refaire un autre",
      permission_overwrites: [
        { id: this.guild, type: 0, deny: String(VIEW) },
        { id: owner, type: 1, allow: all },
        { id: me.id, type: 1, allow: all },
      ],
    });
    return ch.id;
  }

  async send(channel: string, content: string, files: string[] = []): Promise<string> {
    const payload = { content, allowed_mentions: { parse: ["users"] } };
    if (!files.length) return (await this.call<{ id: string }>("POST", `/channels/${channel}/messages`, payload)).id;
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ ...payload, attachments: files.map((f, i) => ({ id: i, filename: basename(f) })) }));
    files.forEach((f, i) => form.append(`files[${i}]`, new Blob([readFileSync(f)]), basename(f)));
    return (await this.call<{ id: string }>("POST", `/channels/${channel}/messages`, undefined, form)).id;
  }
  async react(channel: string, msg: string, emoji: string) { await this.call("PUT", `/channels/${channel}/messages/${msg}/reactions/${encodeURIComponent(emoji)}/@me`); }
  async reactors(channel: string, msg: string, emoji: string): Promise<string[]> {
    return (await this.call<{ id: string }[]>("GET", `/channels/${channel}/messages/${msg}/reactions/${encodeURIComponent(emoji)}?limit=100`)).map((u) => u.id);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
