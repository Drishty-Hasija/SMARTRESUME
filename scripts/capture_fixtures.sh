#!/usr/bin/env bash
# Regenerate the frontend test fixtures from a throwaway backend instance.
# Usage (from the project root, with the backend's virtualenv active):  bash scripts/capture_fixtures.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
PY="${PYTHON:-python3}"
export DATABASE_URL="sqlite:///$TMP/fixtures.db" UPLOAD_DIR="$TMP/uploads"
cd "$ROOT/backend"
"$PY" -m uvicorn app.main:app --port 8765 >"$TMP/server.log" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true; rm -rf "$TMP"' EXIT
for _ in $(seq 1 60); do curl -sf http://localhost:8765/api/health >/dev/null && break; sleep 2; done
curl -sf http://localhost:8765/api/health >/dev/null || { echo "backend did not start"; exit 1; }

OUT="$ROOT/frontend/src/test/fixtures"; mkdir -p "$OUT"
B=http://localhost:8765
curl -sf -X POST "$B/api/samples/load" > "$OUT/sample.json"
curl -sf -X POST "$B/api/match" -H 'content-type: application/json' -d '{"resume_id":1,"job_id":1}' > "$OUT/match.json"
for pair in "resumes/1:resume" "resumes:resumes" "jobs:jobs" "jobs/1:job" "dashboard:dashboard" "history:history" "user:user" "skills:skills"; do
  curl -sf "$B/api/${pair%%:*}" > "$OUT/${pair##*:}.json"
done
echo "fixtures written to $OUT"
