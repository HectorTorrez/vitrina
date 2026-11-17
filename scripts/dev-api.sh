#!/bin/sh
set -eu
cd "$(dirname "$0")/../api"
export DATABASE_URL="${DATABASE_URL:-host=127.0.0.1 port=55448 dbname=vitrina user=vitrina sslmode=disable}"
export PGPASSWORD="${PGPASSWORD:-${VITRINA_DB_PASSWORD:-vitrina_local}}"
exec go run . "$@"
