#!/bin/sh
# Respaldo diario de PostgreSQL. Uso desde cron:
#   15 3 * * * /ruta/a/vitrina/deploy/backup.sh >> /var/log/vitrina-backup.log 2>&1
set -eu
cd "$(dirname "$0")"
mkdir -p backups
file="backups/vitrina-$(date +%Y%m%d-%H%M%S).dump"
docker compose --env-file .env exec -T db pg_dump -U vitrina -d vitrina -Fc > "$file.tmp"
mv "$file.tmp" "$file"
# Conserva los últimos 14 respaldos.
ls -1t backups/vitrina-*.dump | tail -n +15 | xargs -r rm --
echo "Respaldo creado: $file"
