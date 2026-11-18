// Page d'un résultat partagé (hexapop.app/d/…) pendant le défi du jour : les réponses ne sont pas dans la page.
// On les demande au serveur, qui ne les donne qu'à qui a déjà joué le défi d'aujourd'hui (son compte, ou l'invité
// de ce navigateur). Sinon, le cadenas reste : on ne se gâche pas le défi en regardant les réponses d'un ami.
(() => {
  const box = document.getElementById("answers");
  if (!box) return;
  let guest = "";
  try { guest = localStorage.getItem("hexa.guestId") || ""; } catch { /* navigation privée */ }
  const q = new URLSearchParams({ id: box.dataset.id || "" });
  if (guest) q.set("guest", guest);
  fetch(`/api/share/answers?${q}`, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d || !d.html) return;
      const list = box.querySelector(".rounds");
      list.innerHTML = d.html; // HTML construit et échappé par le serveur (share.ts)
      list.hidden = false;
      box.classList.add("open");
    })
    .catch(() => {});
})();
