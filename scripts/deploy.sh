#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_HOST="${REMOTE_HOST:-47.116.20.7}"
REMOTE_DIR="${REMOTE_DIR:-/www/wwwroot/clickask}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

mkdir -p "$BUILD_DIR/assets"

cp "$ROOT_DIR/index.html" "$BUILD_DIR/index.html"
cp "$ROOT_DIR/assets/clickask.css" "$BUILD_DIR/assets/clickask.css"
cp "$ROOT_DIR/assets/clickask.js" "$BUILD_DIR/assets/clickask.js"

# CR-007: bundle self-hosted html2canvas vendor file (used by screenshot feature).
VENDOR_SRC="$ROOT_DIR/assets/vendor/html2canvas.min.js"
VENDOR_DST_DIR="$BUILD_DIR/assets/vendor"
mkdir -p "$VENDOR_DST_DIR"
if [[ -f "$VENDOR_SRC" ]]; then
  cp "$VENDOR_SRC" "$VENDOR_DST_DIR/html2canvas.min.js"
  echo "vendor: html2canvas bundled ($(wc -c < "$VENDOR_SRC") bytes)"
else
  if command -v curl >/dev/null 2>&1; then
    echo "vendor: html2canvas missing locally, fetching from unpkg\u2026"
    curl -fsSL "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js" -o "$VENDOR_DST_DIR/html2canvas.min.js" || {
      echo "vendor: download failed; deploying without screenshot library (feature will degrade)" >&2
      rm -f "$VENDOR_DST_DIR/html2canvas.min.js"
    }
  else
    echo "vendor: html2canvas missing and curl unavailable; screenshot feature will degrade" >&2
  fi
fi

if [[ "${INCLUDE_DEMO:-0}" == "1" ]]; then
  cp "$ROOT_DIR/demo.html" "$BUILD_DIR/demo.html"
fi

# CR-006: cache-busting manifest. Hash short prefix is enough for single-file uniqueness.
CSS_HASH="$(shasum -a 256 "$BUILD_DIR/assets/clickask.css" | cut -c1-8)"
JS_HASH="$(shasum -a 256 "$BUILD_DIR/assets/clickask.js" | cut -c1-8)"
BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "$BUILD_DIR/assets/manifest.json" <<EOF
{
  "css": "${CSS_HASH}",
  "js": "${JS_HASH}",
  "builtAt": "${BUILT_AT}"
}
EOF
echo "manifest.json: css=${CSS_HASH} js=${JS_HASH}"

echo "Deploying ClickAsk to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
ssh "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p '${REMOTE_DIR}/assets'"
scp -r "$BUILD_DIR"/. "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
ssh "${REMOTE_USER}@${REMOTE_HOST}" "chmod 755 '${REMOTE_DIR}' && chown -R www:www '${REMOTE_DIR}/index.html' '${REMOTE_DIR}/assets' && find '${REMOTE_DIR}/assets' -type d -exec chmod 755 {} \\; && find '${REMOTE_DIR}/assets' -type f -exec chmod 644 {} \\;"
echo "Deploy complete."
