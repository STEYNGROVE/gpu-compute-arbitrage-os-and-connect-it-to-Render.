#!/usr/bin/env bash
set -euo pipefail

mkdir -p test/fixtures/tls

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout test/fixtures/tls/server.key \
  -out test/fixtures/tls/server.crt \
  -days 365 \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost"

chmod 600 test/fixtures/tls/server.key

echo "PASS: Temporary localhost TLS fixture generated"
