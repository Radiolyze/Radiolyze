#!/bin/sh
# Renders /etc/nginx/conf.d/default.conf from nginx.conf.template, injecting
# a precomputed Basic Auth header for the /dicom-web/ proxy so the browser
# never has to know Orthanc's credentials (mirrors the Vite dev-server
# proxy's approach — see DICOM_WEB_PROXY_USERNAME/PASSWORD in env.example).
#
# Runs as one of the official nginx image's /docker-entrypoint.d/ startup
# scripts (executed by /docker-entrypoint.sh before nginx starts). Deliberately
# does its own explicit envsubst call — restricted to the one variable it
# defines — rather than relying on the image's built-in template mechanism,
# so nginx's own $host/$uri/... runtime variables are never touched.
set -eu

: "${DICOM_WEB_PROXY_USERNAME:=orthanc}"

# No default for the password: this image is the production frontend, and a
# fallback would silently proxy DICOMweb with the well-known orthanc/orthanc
# credentials on any deployment that forgot to configure them.
if [ -z "${DICOM_WEB_PROXY_PASSWORD:-}" ]; then
  echo "FATAL: DICOM_WEB_PROXY_PASSWORD is not set - refusing to start nginx with unconfigured DICOMweb credentials." >&2
  exit 1
fi

DICOM_WEB_PROXY_AUTH_B64=$(printf '%s:%s' "$DICOM_WEB_PROXY_USERNAME" "$DICOM_WEB_PROXY_PASSWORD" | base64 | tr -d '\n')
export DICOM_WEB_PROXY_AUTH_B64

envsubst '${DICOM_WEB_PROXY_AUTH_B64}' \
  < /etc/nginx/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf
