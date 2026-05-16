#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${APP_DATA_DIR:-$ROOT_DIR/backend/data}"
UPDATE_DIR="${MOBILE_UPDATE_DIR:-$DATA_DIR/mobile-updates}"
MANIFEST_PATH="${MOBILE_UPDATE_MANIFEST_PATH:-$UPDATE_DIR/manifest.json}"
SERVICE_NAME="${SERVICE_NAME:-ai-baby-growth-companion}"
SSH_TARGET="${MOBILE_UPDATE_OSS_SSH_TARGET:-}"
ECS_HOST="${ECS_HOST:-}"
ECS_USER="${ECS_USER:-root}"
ECS_PORT="${ECS_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"
REMOTE_CONFIG_DIR="${REMOTE_CONFIG_DIR:-/etc/ai-baby-growth-companion}"
REMOTE_USER="${REMOTE_USER:-babyapp}"
OSS_ACL="${MOBILE_UPDATE_OSS_ACL:-}"
MANIFEST_MODE="${MOBILE_UPDATE_OSS_MANIFEST_MODE:-signed}"
INTELLIJ_MAVEN="/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn"

usage() {
  cat <<EOF
Usage:
  MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun scripts/upload-mobile-update-oss.sh

Or provide OSS config directly:
  ALIYUN_OSS_ENDPOINT=... \\
  ALIYUN_OSS_BUCKET=... \\
  ALIYUN_OSS_ACCESS_KEY_ID=... \\
  ALIYUN_OSS_ACCESS_KEY_SECRET=... \\
  scripts/upload-mobile-update-oss.sh

Optional:
  MOBILE_UPDATE_OSS_PREFIX=baby-companion/mobile-updates
  MOBILE_UPDATE_OSS_PUBLIC_BASE_URL=https://cdn.example.com/mobile-updates
  MOBILE_UPDATE_OSS_MANIFEST_MODE=signed|public
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "Mobile update manifest was not found: $MANIFEST_PATH" >&2
  exit 1
fi

FILE_NAME="${MOBILE_UPDATE_FILE_NAME:-$(node -e "const fs=require('node:fs'); const m=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); console.log(m.fileName || '');" "$MANIFEST_PATH")}"
if [[ -z "$FILE_NAME" ]]; then
  echo "Mobile update manifest does not contain fileName." >&2
  exit 1
fi

BUNDLE_PATH="${MOBILE_UPDATE_BUNDLE_PATH:-$UPDATE_DIR/bundles/$FILE_NAME}"
if [[ ! -f "$BUNDLE_PATH" ]]; then
  echo "Mobile update bundle was not found: $BUNDLE_PATH" >&2
  exit 1
fi

ssh_args=(-p "$ECS_PORT")
if [[ -n "$SSH_KEY" ]]; then
  ssh_args+=(-i "$SSH_KEY")
fi

if [[ -z "$SSH_TARGET" && -n "$ECS_HOST" ]]; then
  SSH_TARGET="$ECS_USER@$ECS_HOST"
fi

remote() {
  ssh "${ssh_args[@]}" "$SSH_TARGET" "$@"
}

remote_file() {
  local file_path="$1"
  remote "REMOTE_USER='$REMOTE_USER' FILE_PATH='$file_path' bash -s" <<'REMOTE_READ'
set -euo pipefail
if [[ "$(id -u)" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi
$SUDO cat "$FILE_PATH"
REMOTE_READ
}

remote_env_value() {
  local key="$1"
  local remote_environment="$2"
  printf '%s\n' "$remote_environment" | tr ' ' '\n' | awk -F= -v key="$key" '$1 == key {print substr($0, length(key) + 2); exit}'
}

if [[ -n "$SSH_TARGET" ]]; then
  remote_environment="$(remote "systemctl show '$SERVICE_NAME' -p Environment --value 2>/dev/null || true")"
  ALIYUN_OSS_ENDPOINT="${ALIYUN_OSS_ENDPOINT:-$(remote_env_value ALIYUN_OSS_ENDPOINT "$remote_environment")}"
  ALIYUN_OSS_BUCKET="${ALIYUN_OSS_BUCKET:-$(remote_env_value ALIYUN_OSS_BUCKET "$remote_environment")}"
  ALIYUN_OSS_OBJECT_PREFIX="${ALIYUN_OSS_OBJECT_PREFIX:-$(remote_env_value ALIYUN_OSS_OBJECT_PREFIX "$remote_environment")}"
  ALIYUN_OSS_ACCESS_KEY_ID_FILE="${ALIYUN_OSS_ACCESS_KEY_ID_FILE:-$(remote_env_value ALIYUN_OSS_ACCESS_KEY_ID_FILE "$remote_environment")}"
  ALIYUN_OSS_ACCESS_KEY_SECRET_FILE="${ALIYUN_OSS_ACCESS_KEY_SECRET_FILE:-$(remote_env_value ALIYUN_OSS_ACCESS_KEY_SECRET_FILE "$remote_environment")}"
  ALIYUN_OSS_ACCESS_KEY_ID="${ALIYUN_OSS_ACCESS_KEY_ID:-$(remote_file "${ALIYUN_OSS_ACCESS_KEY_ID_FILE:-$REMOTE_CONFIG_DIR/aliyun_oss_access_key_id}")}"
  ALIYUN_OSS_ACCESS_KEY_SECRET="${ALIYUN_OSS_ACCESS_KEY_SECRET:-$(remote_file "${ALIYUN_OSS_ACCESS_KEY_SECRET_FILE:-$REMOTE_CONFIG_DIR/aliyun_oss_access_key_secret}")}"
fi

ALIYUN_OSS_ENDPOINT="${ALIYUN_OSS_ENDPOINT:-}"
ALIYUN_OSS_BUCKET="${ALIYUN_OSS_BUCKET:-}"
ALIYUN_OSS_OBJECT_PREFIX="${ALIYUN_OSS_OBJECT_PREFIX:-baby-companion}"
ALIYUN_OSS_ACCESS_KEY_ID="${ALIYUN_OSS_ACCESS_KEY_ID:-}"
ALIYUN_OSS_ACCESS_KEY_SECRET="${ALIYUN_OSS_ACCESS_KEY_SECRET:-}"

if [[ -z "$ALIYUN_OSS_ENDPOINT" || -z "$ALIYUN_OSS_BUCKET" || -z "$ALIYUN_OSS_ACCESS_KEY_ID" || -z "$ALIYUN_OSS_ACCESS_KEY_SECRET" ]]; then
  usage
  echo
  echo "OSS endpoint, bucket, access key id, and access key secret are required." >&2
  exit 1
fi

trim_slashes() {
  local value="$1"
  value="${value#/}"
  value="${value%/}"
  printf '%s' "$value"
}

ENDPOINT_SCHEME="https"
ENDPOINT_HOST="$ALIYUN_OSS_ENDPOINT"
if [[ "$ENDPOINT_HOST" == http://* ]]; then
  ENDPOINT_SCHEME="http"
  ENDPOINT_HOST="${ENDPOINT_HOST#http://}"
elif [[ "$ENDPOINT_HOST" == https://* ]]; then
  ENDPOINT_SCHEME="https"
  ENDPOINT_HOST="${ENDPOINT_HOST#https://}"
fi
ENDPOINT_HOST="${ENDPOINT_HOST%/}"

OSS_PREFIX="$(trim_slashes "${MOBILE_UPDATE_OSS_PREFIX:-$ALIYUN_OSS_OBJECT_PREFIX/mobile-updates}")"
OBJECT_KEY="${MOBILE_UPDATE_OSS_OBJECT_KEY:-$OSS_PREFIX/$FILE_NAME}"
OBJECT_KEY="$(trim_slashes "$OBJECT_KEY")"

if [[ "$ENDPOINT_HOST" == "$ALIYUN_OSS_BUCKET."* ]]; then
  OSS_HOST="$ENDPOINT_HOST"
else
  OSS_HOST="$ALIYUN_OSS_BUCKET.$ENDPOINT_HOST"
fi
OBJECT_URL="$ENDPOINT_SCHEME://$OSS_HOST/$OBJECT_KEY"
PUBLIC_BASE_URL="${MOBILE_UPDATE_OSS_PUBLIC_BASE_URL:-$ENDPOINT_SCHEME://$OSS_HOST/$OSS_PREFIX}"
PUBLIC_URL="${MOBILE_UPDATE_OSS_PUBLIC_URL:-${PUBLIC_BASE_URL%/}/$FILE_NAME}"

echo "Uploading mobile update bundle to OSS: $OBJECT_KEY"

resolve_maven() {
  if [[ -n "${MAVEN_BIN:-}" && -x "$MAVEN_BIN" ]]; then
    echo "$MAVEN_BIN"
    return
  fi
  if [[ -x "$INTELLIJ_MAVEN" ]]; then
    echo "$INTELLIJ_MAVEN"
    return
  fi
  if command -v mvn >/dev/null 2>&1; then
    command -v mvn
    return
  fi
  echo "Maven was not found. Set MAVEN_BIN to a Maven executable." >&2
  exit 1
}

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
CLASSPATH_FILE="$TMP_DIR/classpath.txt"
(cd "$ROOT_DIR/backend" && "$(resolve_maven)" -q -DincludeScope=runtime -Dmdep.outputFile="$CLASSPATH_FILE" dependency:build-classpath)

cat > "$TMP_DIR/MobileUpdateOssUploader.java" <<'JAVA'
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.model.CannedAccessControlList;
import com.aliyun.oss.model.ObjectMetadata;
import java.io.File;

public class MobileUpdateOssUploader {
    public static void main(String[] args) {
        String endpoint = env("ALIYUN_OSS_ENDPOINT");
        String bucket = env("ALIYUN_OSS_BUCKET");
        String accessKeyId = env("ALIYUN_OSS_ACCESS_KEY_ID");
        String accessKeySecret = env("ALIYUN_OSS_ACCESS_KEY_SECRET");
        String objectKey = env("MOBILE_UPDATE_OSS_OBJECT_KEY");
        String bundlePath = env("MOBILE_UPDATE_BUNDLE_PATH");
        String acl = System.getenv("MOBILE_UPDATE_OSS_ACL");

        OSS client = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
        try {
            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentType("application/zip");
            metadata.setCacheControl("public, max-age=31536000, immutable");
            client.putObject(bucket, objectKey, new File(bundlePath), metadata);
            if ("public-read".equalsIgnoreCase(acl)) {
                client.setObjectAcl(bucket, objectKey, CannedAccessControlList.PublicRead);
            }
        } finally {
            client.shutdown();
        }
    }

    private static String env(String key) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(key + " is required");
        }
        return value;
    }
}
JAVA

OSS_CLASSPATH="$(cat "$CLASSPATH_FILE")"
javac -cp "$OSS_CLASSPATH" "$TMP_DIR/MobileUpdateOssUploader.java"
ALIYUN_OSS_ENDPOINT="$ALIYUN_OSS_ENDPOINT" \
ALIYUN_OSS_BUCKET="$ALIYUN_OSS_BUCKET" \
ALIYUN_OSS_ACCESS_KEY_ID="$ALIYUN_OSS_ACCESS_KEY_ID" \
ALIYUN_OSS_ACCESS_KEY_SECRET="$ALIYUN_OSS_ACCESS_KEY_SECRET" \
MOBILE_UPDATE_OSS_OBJECT_KEY="$OBJECT_KEY" \
MOBILE_UPDATE_BUNDLE_PATH="$BUNDLE_PATH" \
MOBILE_UPDATE_OSS_ACL="$OSS_ACL" \
java -cp "$TMP_DIR:$OSS_CLASSPATH" MobileUpdateOssUploader

PUBLIC_URL="$PUBLIC_URL" OBJECT_KEY="$OBJECT_KEY" MANIFEST_MODE="$MANIFEST_MODE" MANIFEST_PATH="$MANIFEST_PATH" node <<'NODE'
const fs = require("node:fs");
const manifestPath = process.env.MANIFEST_PATH;
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (process.env.MANIFEST_MODE === "public") {
  manifest.url = process.env.PUBLIC_URL;
  delete manifest.ossObjectKey;
} else {
  manifest.url = "";
  manifest.ossObjectKey = process.env.OBJECT_KEY;
}
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

if [[ "$MANIFEST_MODE" == "public" ]]; then
  echo "Mobile update OSS URL:"
  echo "  $PUBLIC_URL"
else
  echo "Mobile update OSS object key:"
  echo "  $OBJECT_KEY"
fi
