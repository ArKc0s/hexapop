#!/usr/bin/env bash
# Met à jour le studio des reels sur hexa-studio et redémarre le service.
# Usage : ./deploy/studio.sh   (depuis la racine du dépôt ; machine : STUDIO_HOST, par défaut hexa@192.168.1.21)
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${STUDIO_HOST:-hexa@192.168.1.21}"
(cd apps/studio && node --test src/*.test.ts >/dev/null) || { echo "tests du studio en échec" >&2; exit 1; }
tar -cf - apps/studio/src apps/studio/page apps/studio/package.json \
  packages/data/src/departements.json packages/data/src/regions.json apps/server/fonts \
  | ssh "$HOST" 'mkdir -p ~/studio/app && tar -C ~/studio/app -xf -'
ssh "$HOST" 'sudo -n systemctl restart hexa-studio 2>/dev/null || echo "(service non redémarré : sudo indisponible pour cet utilisateur)"'
echo "studio à jour"
