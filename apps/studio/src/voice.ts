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
  if (existsSync(wav) && existsSync(meta) && !truncated(readFileSync(wav).subarray(44))) return { ...JSON.parse(readFileSync(meta, "utf8")), wav, chars: 0 };
  // Le modèle v3 coupe souvent la fin d'une phrase (surtout les questions) : on la termine par « ... », ce qui suffit
  // presque toujours, et on la refait (autre tirage) tant qu'elle finit encore en plein son.
  let r: { audio_base64: string; normalized_alignment?: Align; alignment?: Align } | undefined, pcm = Buffer.alloc(0), chars = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response | undefined;
    for (let i = 0; i < 3; i++) {
      res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[voice]}/with-timestamps?output_format=pcm_${RATE}`, {
        method: "POST", headers: { "xi-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({ text: /[?!.]$/.test(text) ? text + "..." : text, model_id: "eleven_v3", language_code: "fr", seed: 1000 + attempt * 7919, voice_settings: { stability: 0.0, similarity_boost: 0.8 } }),
        signal: AbortSignal.timeout(120_000),
      });
      if (res.ok || res.status < 500) break;
      await new Promise((ok) => setTimeout(ok, 5000 * (i + 1)));
    }
    if (!res!.ok) throw new Error(`ElevenLabs ${res!.status} : ${(await res!.text()).slice(0, 300)}`);
    r = (await res!.json()) as typeof r;
    pcm = Buffer.from(r!.audio_base64, "base64"); chars += text.length;
    if (!truncated(pcm)) break;
  }
  const head = Buffer.alloc(44);
  head.write("RIFF", 0); head.writeUInt32LE(36 + pcm.length, 4); head.write("WAVEfmt ", 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24); head.writeUInt32LE(RATE * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write("data", 36); head.writeUInt32LE(pcm.length, 40);
  writeFileSync(wav, Buffer.concat([head, pcm]));
  const sp: Spoken = { dur: pcm.length / (RATE * 2), words: words(r!.normalized_alignment ?? r!.alignment) };
  writeFileSync(meta, JSON.stringify(sp));
  return { ...sp, wav, chars };
}

/** Vrai si le son finit en plein mot (encore de l'énergie dans les 30 dernières millisecondes). */
export function truncated(pcm: Buffer): boolean {
  const n = Math.floor(pcm.length / 2), from = Math.max(0, n - Math.round(RATE * 0.03));
  let peak = 0; for (let i = from; i < n; i++) peak = Math.max(peak, Math.abs(pcm.readInt16LE(i * 2)));
  return peak > 6000;
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
