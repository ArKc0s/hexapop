// Publication sur Instagram (API Instagram avec connexion Instagram) : envoi direct du fichier (« resumable »),
// donc pas besoin d'héberger la vidéo à une adresse publique. Le jeton (60 jours) est renouvelé tout seul.
import { readFileSync, statSync } from "node:fs";

const G = "https://graph.instagram.com/v23.0";
export interface IgAuth { token: string; refreshedAt: number; userId?: string; username?: string }

async function j<T>(res: Response): Promise<T> {
  const body = await res.text();
  if (!res.ok) throw new Error(`Instagram ${res.status} : ${body.slice(0, 400)}`);
  return JSON.parse(body) as T;
}

/** Renouvelle le jeton s'il a plus de 20 jours (il expire au bout de 60). */
export async function refresh(a: IgAuth): Promise<IgAuth> {
  if (Date.now() - a.refreshedAt < 20 * 86_400_000 && a.userId) return a;
  let token = a.token;
  if (Date.now() - a.refreshedAt >= 20 * 86_400_000) {
    token = (await j<{ access_token: string }>(await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(a.token)}`))).access_token;
  }
  const me = await j<{ user_id: string; username: string }>(await fetch(`${G}/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`));
  return { token, refreshedAt: token === a.token ? a.refreshedAt : Date.now(), userId: me.user_id, username: me.username };
}

/** Publie un reel ; renvoie son lien. */
export async function publishReel(a: IgAuth, mp4: string, caption: string, cover?: number): Promise<string> {
  const q = new URLSearchParams({ media_type: "REELS", upload_type: "resumable", caption, share_to_feed: "true", access_token: a.token });
  if (cover !== undefined) q.set("thumb_offset", String(Math.round(cover * 1000)));
  const box = await j<{ id: string; uri?: string }>(await fetch(`${G}/${a.userId}/media`, { method: "POST", body: q }));
  const up = await fetch(box.uri ?? `https://rupload.facebook.com/ig-api-upload/v23.0/${box.id}`, {
    method: "POST", headers: { authorization: `OAuth ${a.token}`, offset: "0", file_size: String(statSync(mp4).size) }, body: readFileSync(mp4),
  });
  await j(up);
  for (let i = 0; i < 60; i++) { // Instagram traite la vidéo (souvent moins d'une minute)
    const s = await j<{ status_code: string; status?: string }>(await fetch(`${G}/${box.id}?fields=status_code,status&access_token=${encodeURIComponent(a.token)}`));
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error("Instagram n'a pas pu traiter la vidéo : " + (s.status ?? s.status_code));
    await new Promise((r) => setTimeout(r, 10_000));
  }
  const pub = await j<{ id: string }>(await fetch(`${G}/${a.userId}/media_publish`, { method: "POST", body: new URLSearchParams({ creation_id: box.id, access_token: a.token }) }));
  const link = await j<{ permalink?: string }>(await fetch(`${G}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(a.token)}`)).catch(() => ({ permalink: undefined }));
  return link.permalink ?? `https://www.instagram.com/${a.username ?? ""}`;
}
