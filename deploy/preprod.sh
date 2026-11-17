#!/bin/sh
# Préprod : déploie la branche courante sur preprod.hexapop.app (instance unique, base de test séparée).
# Pour tester une version avant la prod. Coupe quelques secondes la préprod (personne n'y joue pour de vrai).
# Les secrets d'envoi d'e-mails sont repris de la prod ; les autres (connexion Google, notifications) sont absents.
set -eu
[ -f "$(dirname "$0")/.deploy.env" ] && . "$(dirname "$0")/.deploy.env"
: "${HOST:?définis HOST dans deploy/.deploy.env}" "${DIR:?définis DIR dans deploy/.deploy.env}"
cd "$(dirname "$0")/.."
P="$DIR-preprod"
ssh "$HOST" "mkdir -p $P/data"
git archive --format=tar HEAD | ssh "$HOST" "rm -rf $P/src.new && mkdir $P/src.new && tar -x -C $P/src.new && echo $(git rev-parse --short HEAD) > $P/src.new/BUILD_COMMIT && rm -rf $P/src && mv $P/src.new $P/src"
scp -q deploy/compose.preprod.yaml "$HOST:$P/compose.yaml"
PW=$(sed -n 's/^mot de passe: //p' "$HOME/.hexa_preprod" 2>/dev/null || true)
ssh "$HOST" "P=$P PROD=$DIR PREPROD_PW='$PW' sh -s" <<'REMOTE'
set -eu
cd "$P"
if [ ! -f .env ]; then
  # Une fois : e-mails comme la prod, secrets propres à la préprod (jamais affichés).
  grep '^SMTP_' "$PROD/.env" > .env || true
  echo "DAILY_SECRET=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')" >> .env
  echo "STATS_TOKEN=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')" >> .env
  chmod 600 .env
fi
# Mot de passe des testeurs (page de connexion de la préprod), transmis depuis ~/.hexa_preprod sans être affiché.
if [ -n "${PREPROD_PW:-}" ]; then grep -v '^PREPROD_PASSWORD=' .env > .env.tmp || true; echo "PREPROD_PASSWORD=$PREPROD_PW" >> .env.tmp; mv .env.tmp .env; chmod 600 .env; fi
docker compose -p hexapop-preprod build --pull
docker compose -p hexapop-preprod up -d --force-recreate
for i in $(seq 1 40); do curl -fsS -m 2 http://127.0.0.1:8790/api/health >/dev/null 2>&1 && break; sleep 1; done
curl -fsS http://127.0.0.1:8790/version.json; echo
docker image prune -f >/dev/null
REMOTE
echo "Préprod : https://preprod.hexapop.app ($(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD))"
