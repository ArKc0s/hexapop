// Page temporaire de la préprod : trouver la forme de partage qui marche partout (Snapchat restait sur un écran noir).
// À supprimer une fois la bonne variante choisie.
(async () => {
  const TEXT = "HEXA #3 · défi du jour · Confirmé\n✅✅🟧❌✅✅✅🟧✅✅\n8 justes, 2 à moitié, 1 raté · 1 234 points";
  const URL_ = "https://hexapop.app/d/exemple";
  const log = (m) => (document.getElementById("log").textContent = m);

  // Une image proche de la vraie carte de score, préparée dès l'ouverture (le tap ne fait plus que partager).
  const draw = (type) => new Promise((ok) => {
    const c = document.createElement("canvas"); c.width = c.height = 1080;
    const g = c.getContext("2d");
    g.fillStyle = "#f3eee4"; g.fillRect(0, 0, 1080, 1080);
    g.fillStyle = "#ffffff"; g.beginPath(); g.roundRect(90, 90, 900, 900, 60); g.fill();
    g.fillStyle = "#1c1a37"; g.font = "900 120px sans-serif"; g.textAlign = "center"; g.fillText("HEXA #3", 540, 330);
    g.font = "900 200px sans-serif"; g.fillStyle = "#ff4fae"; g.fillText("1 234", 548, 588); g.fillStyle = "#1c1a37"; g.fillText("1 234", 540, 580);
    const cols = ["#22b07d", "#22b07d", "#ffd93d", "#ff4fae", "#22b07d"];
    cols.forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.roundRect(215 + i * 135, 680, 110, 110, 24); g.fill(); });
    g.fillStyle = "#6b6884"; g.font = "700 44px sans-serif"; g.fillText("hexapop.app", 540, 900);
    c.toBlob((b) => ok(new File([b], type === "image/png" ? "hexa-defi.png" : "hexa-defi.jpg", { type })), type, 0.92);
  });
  const png = await draw("image/png"), jpg = await draw("image/jpeg");
  // Aperçu en data: (la politique de sécurité du site refuse les images blob:).
  const rd = new FileReader(); rd.onload = () => (document.getElementById("apercu").src = rd.result); rd.readAsDataURL(png);

  const variants = [
    ["A. Image + texte avec le lien (le bouton actuel)", { files: [png], text: `${TEXT}\n${URL_}` }],
    ["B. Image + texte, lien à part (champ url)", { files: [png], text: TEXT, url: URL_ }],
    ["C. Image + texte sans lien", { files: [png], text: TEXT }],
    ["D. Image + lien seul", { files: [png], url: URL_ }],
    ["E. Image + texte + titre vide", { files: [png], title: "", text: `${TEXT}\n${URL_}` }],
    ["F. Image en JPEG + texte avec le lien", { files: [jpg], text: `${TEXT}\n${URL_}` }],
    ["G. Image seule", { files: [png] }],
    ["H. Texte avec le lien seul (sans image)", { text: `${TEXT}\n${URL_}` }],
  ];
  const box = document.getElementById("btns");
  for (const [name, data] of variants) {
    const b = document.createElement("button");
    b.innerHTML = `${name}<small>${data.files ? `${data.files[0].type}, ${Math.round(data.files[0].size / 1024)} Ko` : "texte"}${data.url ? " · url" : ""}${data.text ? " · texte" : ""}</small>`;
    b.onclick = async () => {
      if (!navigator.share) return log("Partage natif indisponible sur ce navigateur.");
      if (data.files && !navigator.canShare?.(data)) return log(`${name} : refusé par canShare.`);
      try { await navigator.share(data); log(`${name} : partage terminé.`); }
      catch (e) { log(`${name} : ${e.name} ${e.message}`); }
    };
    box.appendChild(b);
  }
})();
