// Secours Cloudflare (palier 0) : Hexa passe par ce Worker. Si le serveur du homelab ne répond pas
// (panne de courant, box, machine), on sert une copie de l'appli hébergée chez Cloudflare :
// les séances et l'Entraînement restent jouables, même pour quelqu'un qui n'est jamais venu.
// Le défi, le multi et les comptes répondent « hors ligne » jusqu'au retour du serveur.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      const res = await fetch(request, { signal: AbortSignal.timeout(8000) });
      // 52x : Cloudflare n'arrive pas à joindre le serveur.
      if (res.status < 520) return res;
    } catch { /* serveur injoignable ou trop lent */ }
    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "offline", message: "Hexa est en mode secours : le défi et le multi reviennent bientôt." }, { status: 503 });
    }
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Indisponible", { status: 503 });
    // Fichiers de l'appli, sinon la page (application d'une seule page).
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
    return env.ASSETS.fetch(new Request(new URL("/", url), request));
  },
};
