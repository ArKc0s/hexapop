// Fabrique un reel : voix → ligne de temps → images (navigateur sans écran) + musique → montage ffmpeg.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import type { Plan } from "./formats.ts";
import { Timeline, estimate, spokenText, type Spoken } from "./timeline.ts";
import { speak, type VoiceName } from "./voice.ts";

const PAGE = fileURLToPath(new URL("../page/reel.html", import.meta.url));
const FPS = 30;

export interface Made { dir: string; mp4: string; dur: number; chars: number; script: string[] }

export async function make(p: Plan, voice: VoiceName, dir: string, o: { elevenKey: string; cache: string; log?: (s: string) => void }): Promise<Made> {
  const log = o.log ?? (() => {});
  mkdirSync(dir, { recursive: true });
  // 1. Les phrases à faire lire (premier passage, durées estimées), puis les vraies voix.
  const dry = new Timeline(estimate); p.build(dry);
  const spoken = new Map<string, Spoken & { wav: string }>(); let chars = 0;
  for (const { line } of dry.voice) {
    if (spoken.has(line.text)) continue;
    const v = await speak(o.elevenKey, o.cache, voice, line.text); chars += v.chars;
    spoken.set(line.text, v);
  }
  log(`voix : ${spoken.size} phrases, ${chars} caractères facturés`);
  // 2. La vraie ligne de temps.
  const tl = new Timeline((text) => spoken.get(text)!); p.build(tl);
  const dur = Math.ceil((tl.t + 0.4) * 2) / 2;
  const script = { dur, els: tl.els, dings: tl.dings };
  writeFileSync(join(dir, "script.json"), JSON.stringify({ ...script, voice: tl.voice }, null, 1));
  // 3. Les images et la musique.
  const frames = join(dir, "f"); rmSync(frames, { recursive: true, force: true }); mkdirSync(frames);
  const b = await chromium.launch();
  try {
    const pg = await b.newPage({ viewport: { width: 540, height: 960 } });
    await pg.goto("file://" + PAGE); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(300);
    await pg.evaluate((s) => (window as unknown as { load: (s: unknown) => number }).load(s), script);
    writeFileSync(join(dir, "musique.wav"), Buffer.from(await pg.evaluate(() => (window as unknown as { renderAudio: () => Promise<string> }).renderAudio()), "base64"));
    const n = Math.round(dur * FPS), t0 = Date.now();
    for (let i = 0; i < n; i++) {
      const jpg = await pg.evaluate((t) => (window as unknown as { jpeg: (t: number) => string }).jpeg(t), i / FPS);
      writeFileSync(join(frames, String(i).padStart(5, "0") + ".jpg"), Buffer.from(jpg, "base64"));
    }
    log(`images : ${n} en ${Math.round((Date.now() - t0) / 1000)} s`);
  } finally { await b.close(); }
  // 4. Montage en deux passes (le son, puis la vidéo) : la mémoire reste sous 500 Mo.
  const ff = (args: string[]) => execFileSync("nice", ["-n", "10", "ffmpeg", "-y", "-loglevel", "error", ...args], { stdio: "inherit" });
  const ins = ["-i", join(dir, "musique.wav")], fl: string[] = [];
  tl.voice.forEach(({ line, t }, i) => {
    ins.push("-i", spoken.get(line.text)!.wav);
    const ms = Math.round(t * 1000);
    fl.push(`[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},volume=1.4[v${i}]`);
  });
  const nv = tl.voice.length;
  fl.push(`${Array.from({ length: nv }, (_, i) => `[v${i}]`).join("")}amix=inputs=${nv}:normalize=0,apad=whole_dur=${dur}[vox]`, "[vox]asplit=2[vox1][vox2]", "[0:a]volume=0.7[mus]",
    "[mus][vox1]sidechaincompress=threshold=0.02:ratio=5:attack=15:release=350[duck]", "[duck][vox2]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]");
  const son = join(dir, "son.m4a"), mp4 = join(dir, "reel.mp4");
  ff([...ins, "-filter_complex", fl.join(";"), "-map", "[a]", "-t", String(dur), "-c:a", "aac", "-b:a", "192k", son]);
  ff(["-framerate", String(FPS), "-i", join(frames, "%05d.jpg"), "-i", son, "-map", "0:v", "-map", "1:a", "-threads", "2", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
    "-x264-params", "rc-lookahead=20", "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", "copy", "-shortest", "-movflags", "+faststart", mp4]);
  rmSync(frames, { recursive: true, force: true }); rmSync(join(dir, "musique.wav"), { force: true });
  // Une image de couverture (le moment de l'accroche) pour l'aperçu.
  ff(["-ss", "1.6", "-i", mp4, "-frames:v", "1", "-q:v", "3", join(dir, "couverture.jpg")]);
  return { dir, mp4, dur, chars, script: tl.voice.map((v) => spokenText(v.line.text)) };
}
