#!/usr/bin/env bash
# Backup canonico del tenant GlitchTip (custom format, restaurable con pg_restore).
set -e
mkdir -p /root/backups
TS=$(date +%Y%m%d-%H%M%S)
F="/root/backups/glitchtip-${TS}.dump"
docker exec gt-glitch-pg pg_dump -U postgres -Fc glitchtip > "$F"
echo "BACKUP_FILE=$F"
echo "SIZE=$(du -h "$F" | cut -f1)"
# conteo de issues en el momento del backup (para verificar el restore)
echo "ISSUES_AT_BACKUP=$(docker exec gt-glitch-pg psql -U postgres -d glitchtip -t -c 'SELECT count(*) FROM issue_events_issue;' | tr -d ' ')"
# retencion 14 dias
find /root/backups -name 'glitchtip-*.dump' -mtime +14 -delete 2>/dev/null || true
