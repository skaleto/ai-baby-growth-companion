#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
DATA_DIR="${APP_DATA_DIR:-$ROOT_DIR/backend/data}"
UPDATE_DIR="${MOBILE_UPDATE_DIR:-$DATA_DIR/mobile-updates}"
BUNDLE_DIR="$UPDATE_DIR/bundles"
PACKAGE_VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
VERSION="${MOBILE_UPDATE_VERSION:-${1:-${PACKAGE_VERSION}-$(date +%Y%m%d%H%M%S)}}"
FILE_NAME="app-${VERSION}.zip"
BUNDLE_PATH="$BUNDLE_DIR/$FILE_NAME"
PUBLIC_BASE_URL="${MOBILE_UPDATE_PUBLIC_BASE_URL:-${APP_MOBILE_UPDATES_PUBLIC_BASE_URL:-}}"
MIN_NATIVE_VERSION="${MOBILE_UPDATE_MIN_NATIVE_VERSION:-}"
MESSAGE="${MOBILE_UPDATE_MESSAGE:-}"
ENABLED="${MOBILE_UPDATE_ENABLED:-true}"

if ! command -v zip >/dev/null 2>&1; then
  echo "zip command is required to build a mobile update bundle." >&2
  exit 1
fi

cd "$ROOT_DIR"
echo "Building web assets..."
npm run build

mkdir -p "$BUNDLE_DIR"
rm -f "$BUNDLE_PATH"

echo "Creating mobile update bundle: $BUNDLE_PATH"
(
  cd "$DIST_DIR"
  zip -qr "$BUNDLE_PATH" .
)

CHECKSUM="$(shasum -a 256 "$BUNDLE_PATH" | awk '{print $1}')"

VERSION="$VERSION" \
FILE_NAME="$FILE_NAME" \
CHECKSUM="$CHECKSUM" \
PUBLIC_BASE_URL="$PUBLIC_BASE_URL" \
MIN_NATIVE_VERSION="$MIN_NATIVE_VERSION" \
MESSAGE="$MESSAGE" \
ENABLED="$ENABLED" \
MANIFEST_PATH="$UPDATE_DIR/manifest.json" \
node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const trim = (value) => (value || "").replace(/\/+$/, "");
const publicBaseUrl = trim(process.env.PUBLIC_BASE_URL);
const fileName = process.env.FILE_NAME;
const manifest = {
  enabled: process.env.ENABLED !== "false",
  version: process.env.VERSION,
  fileName,
  url: publicBaseUrl ? `${publicBaseUrl}/api/mobile-updates/bundles/${fileName}` : "",
  checksum: process.env.CHECKSUM,
  minNativeVersion: process.env.MIN_NATIVE_VERSION || "",
  message: process.env.MESSAGE || "",
};

fs.mkdirSync(path.dirname(process.env.MANIFEST_PATH), { recursive: true });
fs.writeFileSync(process.env.MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

cat <<EOF

Mobile update bundle built.

Version:
  $VERSION

Bundle:
  $BUNDLE_PATH

Manifest:
  $UPDATE_DIR/manifest.json
EOF
