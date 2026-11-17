# Secours Cloudflare (palier 0)

But : si le homelab tombe, `hexapop.app` reste jouable en solo (séances, Entraînement), même pour un nouveau visiteur.
Les joueurs déjà venus ont en plus la copie gardée par leur navigateur (`apps/web/public/sw.js`), sans rien à installer.

## Mise en place (une fois, depuis le compte Cloudflare)
1. Créer un jeton d'API Cloudflare limité à **Workers Scripts : modifier** et **Workers Routes : modifier** sur la zone `hexapop.app`.
2. Depuis `~/hexa` :
   ```sh
   pnpm -C apps/web build
   cd deploy/secours && CLOUDFLARE_API_TOKEN=… npx wrangler deploy
   ```
3. Dans Cloudflare › Workers › hexapop-secours › Routes : régler la route en **« Fail open »**
   (si le quota gratuit de 100 000 requêtes par jour est dépassé, le trafic va directement au serveur au lieu d'échouer).

## Mise à jour
La copie de secours n'a pas besoin d'être à jour au jour près : la refaire de temps en temps (même commande) suffit.

## Tester
Arrêter le conteneur actif sur infra quelques secondes : la page doit rester affichée, avec le bandeau « Hors ligne ».
