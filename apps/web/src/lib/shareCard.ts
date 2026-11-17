// Image de partage du défi du jour (1080 × 1080, prête pour WhatsApp, Discord, Instagram…), dessinée dans le navigateur.
// Mêmes couleurs que le jeu : vert = juste, jaune = à moitié, rose = raté.
export interface DailyCard { number: number; level: string; points: number; seconds: number; grid: number[]; rank?: { rank: number; players: number } | null }

const C = { bg: "#f3eee4", ink: "#1c1a37", soft: "#6b6884", pink: "#ff4fae", pinkD: "#cf2486", blue: "#1572c4", blueD: "#0d4f8c", yellow: "#ffd93d", yellowD: "#d9a90b", green: "#22b07d", greenD: "#16825b", card: "#ffffff", line: "#e6dfd0" };
const POP = '"Bowlby One", Impact, "Arial Black", sans-serif';
const UI = '"Gabarito", system-ui, sans-serif';

function rr(x: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, r: number) {
  x.beginPath(); x.roundRect(X, Y, w, h, r);
}
/** La mascotte : un hexagone rose à ombre bleue, deux yeux et un sourire. */
function mascot(x: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  const hex = (ox: number, oy: number) => {
    x.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; x.lineTo(cx + ox + s * Math.cos(a), cy + oy + s * Math.sin(a)); }
    x.closePath();
  };
  hex(s * 0.1, s * 0.1); x.fillStyle = C.blue; x.fill();
  hex(0, 0); x.fillStyle = C.pink; x.fill();
  for (const dx of [-0.3, 0.3]) {
    x.beginPath(); x.arc(cx + dx * s, cy - 0.08 * s, 0.17 * s, 0, Math.PI * 2); x.fillStyle = "#fff"; x.fill();
    x.beginPath(); x.arc(cx + dx * s + 0.03 * s, cy - 0.06 * s, 0.09 * s, 0, Math.PI * 2); x.fillStyle = C.ink; x.fill();
  }
  x.beginPath(); x.arc(cx, cy + 0.18 * s, 0.2 * s, 0.15 * Math.PI, 0.85 * Math.PI); x.lineWidth = 0.07 * s; x.lineCap = "round"; x.strokeStyle = C.ink; x.stroke();
}

export async function dailyCardBlob(d: DailyCard): Promise<Blob | null> {
  try { await Promise.all([document.fonts.load(`120px ${POP}`), document.fonts.load(`800 40px ${UI}`), document.fonts.load(`600 40px ${UI}`)]); } catch { /* polices de secours */ }
  const W = 1080;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = W;
  const x = cv.getContext("2d");
  if (!x) return null;
  x.fillStyle = C.bg; x.fillRect(0, 0, W, W);
  x.textAlign = "center"; x.textBaseline = "alphabetic";

  // Logo riso : rose décalé sous le bleu
  x.font = `150px ${POP}`;
  x.fillStyle = C.pink; x.fillText("HEXA", W / 2 + 7, 205 + 7);
  x.fillStyle = C.blue; x.fillText("HEXA", W / 2, 205);
  x.font = `800 40px ${UI}`; x.fillStyle = C.soft;
  x.fillText(`Défi du jour n° ${d.number} · ${d.level}`, W / 2, 272);

  // Carte blanche
  rr(x, 90, 320, W - 180, 640, 48); x.fillStyle = C.line; x.fill();
  rr(x, 90, 310, W - 180, 640, 48); x.fillStyle = C.card; x.fill();

  // Score
  x.font = `190px ${POP}`;
  const pts = d.points.toLocaleString("fr-FR");
  x.fillStyle = C.pink; x.fillText(pts, W / 2 + 8, 505 + 8);
  x.fillStyle = C.ink; x.fillText(pts, W / 2, 505);
  x.font = `800 42px ${UI}`; x.fillStyle = C.soft;
  x.fillText(`points · ${d.seconds} s`, W / 2, 568);

  // Grille : 10 cases sur 2 rangées
  const n = d.grid.length, per = Math.min(5, n), size = 104, gap = 22;
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / per), c = i % per, inRow = Math.min(per, n - r * per);
    const X = W / 2 - (inRow * size + (inRow - 1) * gap) / 2 + c * (size + gap), Y = 612 + r * (size + gap);
    const [fill, edge] = d.grid[i] === 2 ? [C.green, C.greenD] : d.grid[i] === 1 ? [C.yellow, C.yellowD] : [C.pink, C.pinkD];
    rr(x, X, Y + 8, size, size, 24); x.fillStyle = edge; x.fill();
    rr(x, X, Y, size, size, 24); x.fillStyle = fill; x.fill();
  }

  // Rang, mascotte et adresse
  if (d.rank) {
    x.font = `800 44px ${UI}`; x.fillStyle = C.ink;
    x.fillText(`${d.rank.rank}${d.rank.rank === 1 ? "er" : "e"} sur ${d.rank.players} joueur${d.rank.players > 1 ? "s" : ""}`, W / 2, 902);
  }
  mascot(x, 160, 1022, 46);
  x.font = `800 40px ${UI}`; x.fillStyle = C.blue; x.textAlign = "right";
  x.fillText("hexapop.app", W - 100, 1036);
  return new Promise((ok) => cv.toBlob((b) => ok(b), "image/png"));
}
