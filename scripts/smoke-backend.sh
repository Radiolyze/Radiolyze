#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"

echo "Checking API health..."
curl -sf "${API_BASE_URL}/api/v1/health" >/dev/null

echo "Creating report..."
create_response=$(
  curl -sS -X POST "${API_BASE_URL}/api/v1/reports/create" \
    -H "Content-Type: application/json" \
    -d '{"study_id":"SMOKE-STUDY-1","patient_id":"SMOKE-PATIENT-1"}'
)

report_id=$(printf '%s' "${create_response}" | python -c "import json,sys; print(json.load(sys.stdin)['id'])")

echo "Queueing inference..."
queue_response=$(
  curl -sS -X POST "${API_BASE_URL}/api/v1/inference/queue" \
    -H "Content-Type: application/json" \
    -d "{\"report_id\":\"${report_id}\",\"requested_by\":\"smoke\"}"
)

job_id=$(printf '%s' "${queue_response}" | python -c "import json,sys; print(json.load(sys.stdin)['job_id'])")

echo "Checking inference status..."
curl -sS "${API_BASE_URL}/api/v1/inference/status/${job_id}" >/dev/null

echo "Smoke check OK."
