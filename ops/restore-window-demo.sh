#!/usr/bin/env bash
# Demuestra la VENTANA DE PERDIDA: un evento live que llega DESPUES del backup se pierde al restaurar.
set -e
KEY=PUBLIC_KEY_PLACEHOLDER
cnt(){ docker exec gt-glitch-pg psql -U postgres -d glitchtip -t -c "SELECT count(*) FROM issue_events_issue;" | tr -d ' '; }
marker(){ docker exec gt-glitch-pg psql -U postgres -d glitchtip -t -c "SELECT count(*) FROM issue_events_issue WHERE title LIKE '%POST_BACKUP_MARKER%';" | tr -d ' '; }

B=/root/backups/window-$(date +%s).dump
docker exec gt-glitch-pg pg_dump -U postgres -Fc glitchtip > "$B"
N1=$(cnt)
echo "1_BACKUP: issues=$N1  (foto tomada aqui)"

# --- evento LIVE que llega DESPUES del backup (lo que haria el feed n8n) ---
EID=$(head -c16 /dev/urandom | od -An -tx1 | tr -d ' \n')
NOW=$(date +%s)
curl -s -X POST https://errors.example.com/api/1/store/ \
  -H "Content-Type: application/json" \
  -H "X-Sentry-Auth: Sentry sentry_key=$KEY, sentry_version=7" \
  -d "{\"event_id\":\"$EID\",\"timestamp\":$NOW,\"platform\":\"javascript\",\"level\":\"error\",\"fingerprint\":[\"POST_BACKUP_MARKER\",\"marker.ts\"],\"exception\":{\"values\":[{\"type\":\"POST_BACKUP_MARKER\",\"value\":\"llegue DESPUES del backup\"}]}}" >/dev/null
sleep 14
echo "2_TRAS_MARKER: issues=$(cnt)  marker_presente=$(marker)  (el dato live ya entro)"

# --- RESTORE (rewind al backup) ---
cd /root/managed-glitchtip
docker compose -p gt-glitch stop gt-glitch-web >/dev/null 2>&1
docker exec gt-glitch-pg psql -U postgres -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='glitchtip';" >/dev/null 2>&1
docker exec gt-glitch-pg psql -U postgres -d postgres -c "DROP DATABASE glitchtip;" >/dev/null
docker exec gt-glitch-pg psql -U postgres -d postgres -c "CREATE DATABASE glitchtip;" >/dev/null
docker exec -i gt-glitch-pg pg_restore -U postgres -d glitchtip < "$B" >/dev/null 2>&1 || true
docker compose -p gt-glitch start gt-glitch-web >/dev/null 2>&1

echo "3_TRAS_RESTORE: issues=$(cnt)  marker_presente=$(marker)  (0 = el evento live post-backup SE PERDIO)"
