#!/usr/bin/env bash
# QND backup diario (cumple 🔴 "backups automáticos"). Cron:  0 3 * * * /ruta/backup.sh acme
# Dumpea el Postgres del tenant a ./backups/. Restore: zcat file | docker exec -i gt-<t>-pg-1 psql -U postgres glitchtip
set -e
TENANT="${1:?uso: ./backup.sh <tenant>}"
mkdir -p backups
TS=$(date +%Y%m%d-%H%M)
docker exec "gt-${TENANT}-pg-1" pg_dump -U postgres glitchtip | gzip > "backups/${TENANT}-${TS}.sql.gz"
echo ">> Backup: backups/${TENANT}-${TS}.sql.gz"
# QND retención: borra backups de >14 días
find backups -name "${TENANT}-*.sql.gz" -mtime +14 -delete 2>/dev/null || true
