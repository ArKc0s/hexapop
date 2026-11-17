#!/bin/sh
# Mise à jour d'Hexa sans coupure, à tout moment (deux versions : bleue / verte, derrière l'aiguilleur).
#  1. construit la nouvelle version pendant que l'actuelle tourne ;
#  2. la démarre sur la couleur libre et vérifie qu'elle répond ;
#  3. bascule l'aiguilleur : nouveaux joueurs sur la nouvelle, parties en cours finies sur l'ancienne ;
#  4. l'ancienne s'arrête seule quand plus personne n'y joue.
# ROUTER=1 : met aussi à jour l'aiguilleur (rare ; coupe les connexions quelques secondes).
# Mode d'emploi et retour arrière : deploy/README.md.
set -eu
[ -f "$(dirname "$0")/.deploy.env" ] && . "$(dirname "$0")/.deploy.env"
: "${HOST:?définis HOST dans deploy/.deploy.env}" "${DIR:?définis DIR dans deploy/.deploy.env}"
cd "$(dirname "$0")/.."

ssh "$HOST" "mkdir -p $DIR/src $DIR/data"
git archive --format=tar HEAD | ssh "$HOST" "rm -rf $DIR/src.new && mkdir $DIR/src.new && tar -x -C $DIR/src.new && rm -rf $DIR/src && mv $DIR/src.new $DIR/src"
scp -q deploy/compose.yaml "$HOST:$DIR/compose.yaml"
ssh "$HOST" "DIR=$DIR ROUTER=${ROUTER:-0} FORCE=${FORCE:-0} sh -s" <<'REMOTE'
set -eu
cd "$DIR"
# Jeton partagé aiguilleur <-> instances (créé une fois, jamais affiché).
grep -q '^INTERNAL_TOKEN=' .env || echo "INTERNAL_TOKEN=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')" >> .env
docker compose build --pull blue
joueurs() { curl -fsS -m 3 http://127.0.0.1:8787/api/health 2>/dev/null | sed -n 's/.*"players":\([0-9]*\).*/\1/p'; }
attendre() { for i in $(seq 1 40); do curl -fsS -m 2 "$1" >/dev/null 2>&1 && return 0; sleep 1; done; echo "pas de réponse : $1"; return 1; }

if ! curl -fsS -m 3 http://127.0.0.1:8786/state >/dev/null 2>&1 || [ "$ROUTER" = 1 ]; then
  # Mise en place (ou mise à jour) de l'aiguilleur : seule étape qui coupe, quelques secondes, donc seulement sans joueurs.
  N=$(joueurs); if [ "${N:-0}" -gt 0 ] && [ "$FORCE" != 1 ]; then echo "Annulé : $N joueur(s) en partie (FORCE=1 pour forcer)."; exit 1; fi
  if docker ps -a --format '{{.Names}}' | grep -qx hexapop; then
    docker stop hexapop >/dev/null
    mkdir -p ../hexapop-avant-bleu-vert && cp -a data/hexa.db* ../hexapop-avant-bleu-vert/ 2>/dev/null || true
  fi
  docker tag hexapop:latest hexapop-router:stable
  ACTIVE=$(sed -n 's/.*"active":"\([a-z]*\)".*/\1/p' data/router.json 2>/dev/null || true)
  docker compose up -d --remove-orphans --force-recreate router "${ACTIVE:-blue}"
  attendre http://127.0.0.1:8787/api/health
  echo; curl -fsS http://127.0.0.1:8787/api/health; echo
  docker image prune -f >/dev/null
  exit 0
fi

ETAT=$(curl -fsS http://127.0.0.1:8786/state)
ACTIVE=$(echo "$ETAT" | sed -n 's/.*"active":"\([a-z]*\)".*/\1/p')
NEW=green; [ "$ACTIVE" = green ] && NEW=blue
# La couleur libre finit peut-être encore les parties de la mise à jour précédente.
if echo "$ETAT" | grep -q "\"draining\":\[[^]]*\"$NEW\"" && [ "$FORCE" != 1 ]; then
  echo "Annulé : $NEW finit encore les parties de la mise à jour précédente. Réessaie plus tard (FORCE=1 pour les couper)."
  exit 1
fi
docker compose up -d --no-deps --force-recreate "$NEW"
attendre "http://127.0.0.1:8786/probe?to=$NEW"
curl -fsS -X POST "http://127.0.0.1:8786/switch?to=$NEW"
docker update --restart=no "hexapop-$ACTIVE" >/dev/null
docker update --restart=unless-stopped "hexapop-$NEW" >/dev/null
docker image prune -f >/dev/null
echo "En ligne : $NEW. $ACTIVE finit ses parties en cours puis s'arrête seule."
REMOTE
