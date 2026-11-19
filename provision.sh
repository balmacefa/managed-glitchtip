#!/usr/bin/env bash
# QND provisioning: 1 comando = 1 tenant nuevo aislado (su propio proyecto docker + su propio Postgres/volumen).
# Uso:  ./provision.sh acme 8001
# Aisla por: -p gt-<tenant> (red/volumen propios). Cumple el 🔴 "aislamiento por tenant".
set -e
TENANT="${1:?uso: ./provision.sh <tenant> <port>}"
PORT="${2:?uso: ./provision.sh <tenant> <port>}"
echo ">> Levantando tenant '$TENANT' en puerto $PORT ..."
TENANT="$TENANT" PORT="$PORT" docker compose -p "gt-$TENANT" up -d
echo ">> Listo: http://localhost:$PORT"
echo ">> Primer login crea el usuario admin. Pasale esa URL al cliente."
