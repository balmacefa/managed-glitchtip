#!/usr/bin/env bash
set -e
cp /tmp/glitch-compose.yml /root/managed-glitchtip/docker-compose.yml
cd /root/managed-glitchtip
echo ">> down -v (fresh DB) ..."
docker compose -p gt-glitch down -v 2>&1 | tail -3
echo ">> up -d ..."
docker compose -p gt-glitch up -d 2>&1 | tail -4
echo ">> esperando migraciones + web (40s) ..."
sleep 40
docker compose -p gt-glitch ps --format "{{.Service}} {{.State}}" 2>/dev/null || docker compose -p gt-glitch ps
