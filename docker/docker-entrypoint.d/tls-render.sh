#!/bin/sh
# Renders /etc/nginx/conf.d/default.conf from nginx-tls.conf.template,
# injecting the TLS server name and certificate paths (GAP-11).
#
# Runs as one of the official nginx image's /docker-entrypoint.d/ startup
# scripts (executed by /docker-entrypoint.sh before nginx starts).
# Deliberately does its own explicit envsubst call — restricted to the
# variables it defines — rather than relying on the image's built-in
# template mechanism, so nginx's own $host/$uri/... runtime variables are
# never touched. Mirrors docker/docker-entrypoint.d/dicom-web-auth.sh.
set -eu

: "${NGINX_SERVER_NAME:=localhost}"
: "${TLS_CERT_PATH:=/etc/nginx/certs/fullchain.pem}"
: "${TLS_KEY_PATH:=/etc/nginx/certs/privkey.pem}"
export NGINX_SERVER_NAME TLS_CERT_PATH TLS_KEY_PATH

envsubst '${NGINX_SERVER_NAME} ${TLS_CERT_PATH} ${TLS_KEY_PATH}' \
  < /etc/nginx/nginx-tls.conf.template \
  > /etc/nginx/conf.d/default.conf
