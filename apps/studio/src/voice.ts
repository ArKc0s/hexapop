// Voix des reels : ElevenLabs (modèle v3), avec le minutage de chaque mot pour caler les sous-titres.
// Chaque phrase est gardée en cache (même voix + même texte = pas de nouvelle dépense).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Spoken, Word } from "./timeline.ts";

export const VOICES = { hugo: "DbbNuBL7lf62XwY7arQb", camille: "Da9VfudgKUvFOKayCiue" } as const;
export type VoiceName = keyof typeof VOICES;
const RATE = 24000; // le 44,1 kHz brut est réservé à l'offre Pro d'ElevenLabs

export interface VoiceFile extends Spoken { wav: string; chars: number }

export async function speak(key: string, cache: string, voice: VoiceName, text: string): Promise<VoiceFile> {
  mkdirSync(cache, { recursive: true });
  const id = createHash("sha256").update(voice + "\n" + text).digest("hex").slice(0, 20);
  const wav = join(cache, id + ".wav"), meta = join(cache, id + ".json");
  if (existsSync(wav) && existsSync(meta)) return { ...JSON.parse(readFileSync(meta, "utf8")), wav, chars: 0 };
  let res: Response | undefined;
  for (let i = 0; i < 3; i++) {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[voice]}/with-timestamps?output_format=pcm_${RATE}`, {
      method: "POST", headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_v3", language_code: "fr", voice_settings: { stability: 0.0, similarity_boost: 0.8 } }),
      signal: AbortSignal.timeout(120_000),
    });
    if (res.ok || res.status < 500) break;
    await new Promise((r) => setTimeout(r, 5000 * (i + 1)));
  }
  if (!res!.ok) throw new Error(`ElevenLabs ${res!.status} : ${(await res!.text()).slice(0, 300)}`);
  const r = (await res!.json()) as { audio_base64: string; normalized_alignment?: Align; alignment?: Align };
  const pcm = Buffer.from(r.audio_base64, "base64");
  const head = Buffer.alloc(44);
  head.write("RIFF", 0); head.writeUInt32LE(36 + pcm.length, 4); head.write("WAVEfmt ", 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24); head.writeUInt32LE(RATE * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write("data", 36); head.writeUInt32LE(pcm.length, 40);
  writeFileSync(wav, Buffer.concat([head, pcm]));
  const sp: Spoken = { dur: pcm.length / (RATE * 2), words: words(r.normalized_alignment ?? r.alignment) };
  writeFileSync(meta, JSON.stringify(sp));
  return { ...sp, wav, chars: text.length };
}

interface Align { characters: string[]; character_start_times_seconds: number[] }
/** Les mots prononcés (les indications entre crochets ne sont pas lues). */
function words(al?: Align): Word[] {
  if (!al) return [];
  const out: Word[] = []; let cur = "", t0 = 0;
  al.characters.forEach((ch, i) => {
    if (!ch.trim()) { if (cur) out.push({ w: cur, t: t0 }); cur = ""; return; }
    if (!cur) t0 = al.character_start_times_seconds[i];
    cur += ch;
  });
  if (cur) out.push({ w: cur, t: t0 });
  return out.filter((w) => !w.w.startsWith("[") && !w.w.endsWith("]")).map((w) => ({ w: w.w, t: Math.round(w.t * 1000) / 1000 }));
}
