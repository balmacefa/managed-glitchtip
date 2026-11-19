#!/usr/bin/env bash
# DRILL backup/restore del tenant GlitchTip (demo). backup -> DROP db (desastre) -> restore -> verificar.
set -e
mkdir -p /root/backups
TS=$(date +%Y%m%d-%H%M%S)
B="/root/backups/drill-${TS}.dump"

echo "=== 1. BACKUP ==="
docker exec gt-glitch-pg pg_dump -U postgres -Fc glitchtip > "$B"
N1=$(docker exec gt-glitch-pg psql -U postgres -d glitchtip -t -c "SELECT count(*) FROM issue_events_issue;" | tr -d ' ')
O1=$(docker exec gt-glitch-pg psql -U postgres -d glitchtip -t -c "SELECT count(*) FROM organizations_organization;" | tr -d ' ')
echo "BACKUP_FILE=$B  SIZE=$(du -h "$B" | cut -f1)  ISSUES=$N1  ORGS=$O1"

echo "=== 2. DESASTRE: stop web + DROP DATABASE ==="
cd /root/managed-glitchtip
docker compose -p gt-glitch stop gt-glitch-web >/dev/null 2>&1
docker exec gt-glitch-pg psql -U postgres -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='glitchtip';" >/dev/null 2>&1
docker exec gt-glitch-pg psql -U postgres -d postgres -c "DROP DATABASE glitchtip;"
docker exec gt-glitch-pg psql -U postgres -d postgres -c "CREATE DATABASE glitchtip;"
LOST=$(docker exec gt-glitch-pg psql -U postgres -d glitchtip -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d ' ')
echo "TRAS_DESASTRE: tablas_en_db=$LOST  (0 = TODO perdido)"

echo "=== 3. RESTORE desde backup ==="
docker exec -i gt-glitch-pg pg_restore -U postgres -d glitchtip < "$B" 2>&1 | tail -2 || true
N2=$(docker exec gt-glitch-pg psql -U postgres -d glitchtip -t -c "SELECT count(*) FROM issue_events_issue;" | tr -d ' ')
O2=$(docker exec gt-glitch-pg psql -U postgres -d glitchtip -t -c "SELECT count(*) FROM organizations_organization;" | tr -d ' ')
echo "TRAS_RESTORE: ISSUES=$N2  ORGS=$O2"

echo "=== 4. restart web ==="
docker compose -p gt-glitch start gt-glitch-web >/dev/null 2>&1

echo "=== RESULTADO ==="
if [ "$N1" = "$N2" ] && [ "$O1" = "$O2" ] && [ "$N2" -gt 0 ]; then
  echo "PASS backup/restore: issues $N1->0->$N2 | orgs $O1->0->$O2 (datos recuperados intactos)"
else
  echo "FAIL: antes issues=$N1 orgs=$O1 | despues issues=$N2 orgs=$O2"
fi
