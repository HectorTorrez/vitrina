#!/bin/sh
# Restaura un respaldo creado por backup.sh.
# Uso: ./restore.sh backups/vitrina-AAAAMMDD-HHMMSS.dump [backups/fotos-AAAAMMDD-HHMMSS.tar.gz]
set -eu
cd "$(dirname "$0")"
[ -f "${1:-}" ] || { echo "uso: $0 ARCHIVO.dump" >&2; exit 1; }
docker compose --env-file .env stop api web
docker compose --env-file .env exec -T db pg_restore -U vitrina -d vitrina --clean --if-exists --no-owner < "$1"
if [ -n "${2:-}" ]; then
  docker run --rm -i -v vitrina-prod_uploads:/fotos alpine tar xzf - -C /fotos < "$2"
fi
docker compose --env-file .env up -d api web
