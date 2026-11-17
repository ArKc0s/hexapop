// Préprod : accès réservé aux testeurs, par un mot de passe commun (PREPROD_PASSWORD) qui pose un cookie.
// Pas de mot de passe HTTP du navigateur : il n'est pas transmis par le script hors ligne de l'appli ni par le temps
// réel, d'où une demande en boucle. Le cookie, lui, l'est partout. Inactif en prod (variable absente).
import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { config } from "./config.ts";

const PASSWORD = process.env.PREPROD_PASSWORD ?? "";
export const preprodGate = config.env === "preprod" && PASSWORD.length > 0;
const COOKIE = "hexa_preprod";
const token = createHmac("sha256", config.dailySecret).update("preprod|" + PASSWORD).digest("base64url");

function cookieOk(req: IncomingMessage): boolean {
  const m = /(?:^|;\s*)hexa_preprod=([\w-]+)/.exec(String(req.headers.cookie ?? ""));
  if (!m) return false;
  const a = Buffer.from(m[1]), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Le temps réel : refusé sans le cookie. */
export const preprodAllowed = (req: IncomingMessage) => !preprodGate || cookieOk(req);

const page = (error = "") => `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hexa · préprod</title><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f3eee4;color:#1c1a37;font:600 17px/1.4 system-ui,sans-serif;padding:16px;box-sizing:border-box}
form{background:#fff;border-radius:28px;padding:26px 22px;width:min(380px,100%);display:flex;flex-direction:column;gap:12px;box-shadow:0 6px 0 #e6dfd0;box-sizing:border-box}
h1{margin:0;font-size:24px;font-weight:900}p{margin:0;color:#6b6884}input{font:inherit;padding:14px;border-radius:14px;border:2px solid #e6dfd0}
button{font:inherit;font-weight:800;border:0;border-radius:16px;padding:14px;background:#ffd93d;box-shadow:0 5px 0 #d9a90b;cursor:pointer}.err{color:#cf2486}</style></head>
<body><form method="post" action="/preprod-login"><h1>Hexa · préprod</h1><p>Version de test, réservée aux testeurs.</p>
<input type="password" name="password" placeholder="Mot de passe" autocomplete="current-password" autofocus required>
${error ? `<p class="err">${error}</p>` : ""}<button>Entrer</button></form></body></html>`;

/** Renvoie true si la requête a été traitée (page de mot de passe, connexion). */
export function preprodHandle(req: IncomingMessage, res: ServerResponse): boolean {
  if (!preprodGate) return false;
  const path = (req.url ?? "/").split("?")[0];
  if (path === "/preprod-login" && req.method === "POST") {
    let body = "";
    req.on("data", (d) => { body += d; if (body.length > 4096) req.destroy(); });
    req.on("end", () => {
      const given = Buffer.from(new URLSearchParams(body).get("password") ?? "");
      const want = Buffer.from(PASSWORD);
      if (given.length === want.length && timingSafeEqual(given, want)) {
        res.writeHead(303, { location: "/", "set-cookie": `${COOKIE}=${token}; Path=/; Max-Age=7776000; HttpOnly; Secure; SameSite=Lax`, "cache-control": "no-store" }).end();
      } else {
        res.writeHead(401, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(page("Mot de passe incorrect."));
      }
    });
    return true;
  }
  if (cookieOk(req)) return false;
  // Sans cookie : la page de mot de passe (401 sans demande du navigateur, jamais mise en cache par le script hors ligne).
  if (path.startsWith("/api/")) { res.writeHead(401, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify({ error: "preprod", message: "Préprod : entre d'abord le mot de passe." })); return true; }
  res.writeHead(401, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(req.method === "HEAD" ? undefined : page());
  return true;
}
