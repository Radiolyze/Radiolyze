#!/usr/bin/env sh
set -e

ORTHANC_URL="${ORTHANC_URL:-http://orthanc:8042}"
ORTHANC_USERNAME="${ORTHANC_USERNAME:-orthanc}"
ORTHANC_PASSWORD="${ORTHANC_PASSWORD:-orthanc}"
ORTHANC_SEED_ENABLED="${ORTHANC_SEED_ENABLED:-true}"
ORTHANC_SEED_URLS="${ORTHANC_SEED_URLS:-https://github.com/pydicom/pydicom-data/raw/master/data/CT_small.dcm}"

if [ "$ORTHANC_SEED_ENABLED" != "true" ]; then
  echo "Orthanc seeding disabled."
  exit 0
fi

auth_args=""
if [ -n "$ORTHANC_USERNAME" ] && [ -n "$ORTHANC_PASSWORD" ]; then
  auth_args="-u ${ORTHANC_USERNAME}:${ORTHANC_PASSWORD}"
fi

echo "Waiting for Orthanc at ${ORTHANC_URL}..."
tries=0
until curl -fsS $auth_args "${ORTHANC_URL}/system" >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -gt 60 ]; then
    echo "Orthanc did not become ready."
    exit 1
  fi
  sleep 1
done

existing_instances="$(curl -fsS $auth_args "${ORTHANC_URL}/instances" || true)"
if [ "${#existing_instances}" -gt 2 ]; then
  echo "Orthanc already has instances, skipping seed."
  exit 0
fi

echo "Seeding Orthanc from URLs: ${ORTHANC_SEED_URLS}"
tmp_dir="$(mktemp -d)"

for url in $(echo "$ORTHANC_SEED_URLS" | tr ',' ' '); do
  file_path="${tmp_dir}/seed.dcm"
  echo "Downloading ${url}"
  curl -fsSL "$url" -o "$file_path"
  echo "Uploading to Orthanc"
  curl -fsS $auth_args -H "Content-Type: application/dicom" --data-binary @"$file_path" "${ORTHANC_URL}/instances" >/dev/null
done

echo "Seeding complete."
