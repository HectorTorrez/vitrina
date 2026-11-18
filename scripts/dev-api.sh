#!/bin/sh
set -eu
cd "$(dirname "$0")/../api"
# Variables locales (Resend, etc.) desde .env en la raíz, si existe.
if [ -f ../.env ]; then
  set -a
  . ../.env
  set +a
fi
export DATABASE_URL="${DATABASE_URL:-host=127.0.0.1 port=55448 dbname=vitrina user=vitrina sslmode=disable}"
export PGPASSWORD="${PGPASSWORD:-${VITRINA_DB_PASSWORD:-vitrina_local}}"
exec go run . "$@"
