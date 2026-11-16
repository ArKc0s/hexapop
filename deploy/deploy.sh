#!/bin/sh
# Envoie la version courante (HEAD) sur infra, reconstruit et relance le conteneur.
set -eu
# Cible lue dans deploy/.deploy.env (non versionné) : HOST=utilisateur@serveur et DIR=/chemin/hexapop
[ -f "$(dirname "$0")/.deploy.env" ] && . "$(dirname "$0")/.deploy.env"
: "${HOST:?définis HOST dans deploy/.deploy.env}" "${DIR:?définis DIR dans deploy/.deploy.env}"
cd "$(dirname "$0")/.."
# Ne pas couper une partie en cours (FORCE=1 pour passer outre).
EN_COURS=$(ssh "$HOST" "curl -fsS -m 5 http://127.0.0.1:8787/api/health 2>/dev/null" | sed -n 's/.*"players":\([0-9]*\).*/\1/p')
if [ "${EN_COURS:-0}" -gt 0 ] && [ "${FORCE:-0}" != 1 ]; then
  echo "Déploiement annulé : $EN_COURS joueur(s) en partie. Relance avec FORCE=1 pour redémarrer quand même."
  exit 1
fi
ssh "$HOST" "mkdir -p $DIR/src $DIR/data"
git archive --format=tar HEAD | ssh "$HOST" "rm -rf $DIR/src.new && mkdir $DIR/src.new && tar -x -C $DIR/src.new && rm -rf $DIR/src && mv $DIR/src.new $DIR/src"
scp deploy/compose.yaml "$HOST:$DIR/compose.yaml"
ssh "$HOST" "cd $DIR && test -f .env && docker compose build --pull && docker compose up -d && docker image prune -f >/dev/null"
ssh "$HOST" "sleep 3; curl -fsS http://127.0.0.1:8787/api/health"
echo
