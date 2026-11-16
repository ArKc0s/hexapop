#!/bin/sh
# Envoie la version courante (HEAD) sur infra, reconstruit et relance le conteneur.
set -eu
HOST=${HOST:-infra@192.168.1.103}
DIR=/home/infra/hexapop
cd "$(dirname "$0")/.."
ssh "$HOST" "mkdir -p $DIR/src $DIR/data"
git archive --format=tar HEAD | ssh "$HOST" "rm -rf $DIR/src.new && mkdir $DIR/src.new && tar -x -C $DIR/src.new && rm -rf $DIR/src && mv $DIR/src.new $DIR/src"
scp deploy/compose.yaml "$HOST:$DIR/compose.yaml"
ssh "$HOST" "cd $DIR && test -f .env && docker compose build --pull && docker compose up -d && docker image prune -f >/dev/null"
ssh "$HOST" "sleep 3; curl -fsS http://127.0.0.1:8787/api/health"
echo
