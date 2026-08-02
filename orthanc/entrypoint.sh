#!/bin/sh
# Renders /etc/orthanc/orthanc.json from orthanc.json.template using
# per-deployment env vars, then starts Orthanc against that config directory
# (the same invocation the base image's own CMD uses).
#
# Orthanc's configuration file has no native env-var substitution, so
# RegisteredUsers/CORS origin would otherwise stay hardcoded regardless of
# what ORTHANC_USERNAME/ORTHANC_PASSWORD/ORTHANC_CORS_ORIGIN are set to.
set -eu

: "${ORTHANC_USERNAME:=orthanc}"
: "${ORTHANC_CORS_ORIGIN:=http://localhost:5173}"

# No default for the password: a fallback here would re-introduce the
# well-known orthanc/orthanc credentials for anyone running this image
# outside docker-compose.yml (which requires ORTHANC_PASSWORD itself).
if [ -z "${ORTHANC_PASSWORD:-}" ]; then
  echo "FATAL: ORTHANC_PASSWORD is not set - refusing to start Orthanc with no configured password." >&2
  exit 1
fi

# Escape for the JSON string context first (backslash, double quote), then
# escape the result for sed's replacement-text syntax (backslash, the `|`
# delimiter, `&`) — so arbitrary credential/origin values (including ones
# containing quotes or backslashes) can't produce invalid JSON or corrupt/
# redirect the substitution itself.
escape_for_json() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

escape_for_sed() {
  printf '%s' "$1" | sed -e 's/[\\|&]/\\&/g'
}

username=$(escape_for_sed "$(escape_for_json "$ORTHANC_USERNAME")")
password=$(escape_for_sed "$(escape_for_json "$ORTHANC_PASSWORD")")
cors_origin=$(escape_for_sed "$(escape_for_json "$ORTHANC_CORS_ORIGIN")")

sed \
  -e "s|\${ORTHANC_USERNAME}|${username}|g" \
  -e "s|\${ORTHANC_PASSWORD}|${password}|g" \
  -e "s|\${ORTHANC_CORS_ORIGIN}|${cors_origin}|g" \
  /etc/orthanc/orthanc.json.template > /etc/orthanc/orthanc.json

exec Orthanc /etc/orthanc/
