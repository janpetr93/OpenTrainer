#!/usr/bin/env bash
# Launch Local Companion + Vite web UI together.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
COMPANION_PID=""
WEB_PID=""

cleanup() {
  if [[ -n "$WEB_PID" ]] && kill -0 "$WEB_PID" 2>/dev/null; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
  if [[ -n "$COMPANION_PID" ]] && kill -0 "$COMPANION_PID" 2>/dev/null; then
    kill "$COMPANION_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

cd "$ROOT"

if [[ ! -d companion/node_modules ]]; then
  echo "Installing companion deps…"
  npm install --prefix companion
fi
if [[ ! -d web/node_modules ]]; then
  echo "Installing web deps…"
  npm install --prefix web
fi

echo "Starting Local Companion on http://127.0.0.1:8787 …"
npm run dev --prefix companion &
COMPANION_PID=$!

# Wait briefly for the API to accept connections (best-effort).
for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:8787/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

echo "Starting web UI (Vite) …"
npm run dev --prefix web &
WEB_PID=$!

echo
echo "Companion PID $COMPANION_PID · Web PID $WEB_PID"
echo "Open the Vite URL in Chrome/Edge. Ctrl+C stops both."
echo

wait
