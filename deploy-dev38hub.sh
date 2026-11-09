#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="${REMOTE_USER:-peppinckj}"
REMOTE_HOST="${REMOTE_HOST:-159.65.27.95}"
IDENTITY_FILE="${IDENTITY_FILE:-C:/Users/Administrator/.ssh/id_ed25519_peppinckj}"
REMOTE_STAGE="${REMOTE_STAGE:-/home/peppinckj/w15-hub-src-20261108}"
REMOTE_PUBLIC="${REMOTE_PUBLIC:-/var/www/th/hub/public}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SSH=(ssh -i "$IDENTITY_FILE")
SCP=(scp -i "$IDENTITY_FILE")
ASSETS=(app.js styles.css index.html)

cd "$SCRIPT_DIR"

echo "Local environment: Windows VS Code Bash"
echo "Remote environment: Debian dev38 as ${REMOTE_USER}@${REMOTE_HOST}"
echo "Deploying static Hub assets to ${REMOTE_PUBLIC}"

node --check app.js
npm test

for asset in "${ASSETS[@]}"; do
  test -f "$asset"
done

"${SCP[@]}" "${ASSETS[@]}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_STAGE}/"

"${SSH[@]}" -t "${REMOTE_USER}@${REMOTE_HOST}" \
  "sudo install -o root -g root -m 0644 ${REMOTE_STAGE}/app.js ${REMOTE_PUBLIC}/app.js && \
   sudo install -o root -g root -m 0644 ${REMOTE_STAGE}/styles.css ${REMOTE_PUBLIC}/styles.css && \
   sudo install -o root -g root -m 0644 ${REMOTE_STAGE}/index.html ${REMOTE_PUBLIC}/index.html"

"${SSH[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
  "sha256sum ${REMOTE_STAGE}/app.js ${REMOTE_PUBLIC}/app.js ${REMOTE_STAGE}/styles.css ${REMOTE_PUBLIC}/styles.css ${REMOTE_STAGE}/index.html ${REMOTE_PUBLIC}/index.html"

echo "Deployment complete. Hard-refresh https://dev38hub.teacherhorizons.com/ to verify the change."