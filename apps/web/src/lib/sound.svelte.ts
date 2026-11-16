// Sons synthétisés (aucun fichier) et vibrations, désactivables. Rien ne joue avant une action de l'utilisateur.
const KEY = "hexa.sound";

class Sound {
  on = $state((() => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } })());
  private ctx: AudioContext | null = null;

  toggle() {
    this.on = !this.on;
    try { localStorage.setItem(KEY, this.on ? "on" : "off"); } catch { /* rien */ }
    if (this.on) this.play("tap");
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.18) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime + start);
    g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + start);
    o.stop(ctx.currentTime + start + dur + 0.05);
  }

  play(kind: "ok" | "partial" | "ko" | "combo" | "level" | "star" | "tap" | "tick", combo = 0) {
    if (!this.on) return;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === "suspended") void this.ctx.resume();
      const up = Math.min(combo, 8) * 40;
      switch (kind) {
        case "ok": this.tone(660 + up, 0, 0.12, "triangle"); this.tone(990 + up, 0.08, 0.18, "triangle"); break;
        case "partial": this.tone(560, 0, 0.16, "triangle"); break;
        case "ko": this.tone(220, 0, 0.22, "square", 0.08); this.tone(165, 0.1, 0.25, "square", 0.07); break;
        case "combo": [0, 0.07, 0.14].forEach((t, i) => this.tone(880 + i * 220 + up, t, 0.12, "triangle", 0.14)); break;
        case "star": this.tone(1320, 0, 0.25, "sine", 0.16); this.tone(1760, 0.05, 0.3, "sine", 0.1); break;
        case "level": [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.1, 0.25, "triangle", 0.16)); break;
        case "tap": this.tone(500, 0, 0.05, "sine", 0.08); break;
        case "tick": this.tone(1000, 0, 0.03, "sine", 0.05); break;
      }
      if (navigator.vibrate) navigator.vibrate(kind === "ko" ? [40, 40, 40] : kind === "ok" || kind === "combo" ? 25 : 0);
    } catch { /* audio indisponible */ }
  }
}
export const sound = new Sound();
