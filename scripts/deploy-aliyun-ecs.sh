#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
SERVICE_NAME="${SERVICE_NAME:-ai-baby-growth-companion}"
ECS_HOST="${ECS_HOST:-${1:-}}"
ECS_USER="${ECS_USER:-root}"
ECS_PORT="${ECS_PORT:-22}"
DEPLOY_PORT="${DEPLOY_PORT:-8300}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/opt/ai-baby-growth-companion}"
REMOTE_DATA_DIR="${REMOTE_DATA_DIR:-/var/lib/ai-baby-growth-companion}"
REMOTE_CONFIG_DIR="${REMOTE_CONFIG_DIR:-/etc/ai-baby-growth-companion}"
REMOTE_USER="${REMOTE_USER:-babyapp}"
SYNC_DATA="${SYNC_DATA:-0}"
SYNC_MOBILE_UPDATES="${SYNC_MOBILE_UPDATES:-0}"
SYNC_MOBILE_UPDATE_MANIFEST_ONLY="${SYNC_MOBILE_UPDATE_MANIFEST_ONLY:-0}"
OVERWRITE_REMOTE_DATA="${OVERWRITE_REMOTE_DATA:-0}"
SKIP_BACKEND_BUILD="${SKIP_BACKEND_BUILD:-0}"
SKIP_KEY_CHECK="${SKIP_KEY_CHECK:-0}"
BUILD_ANDROID="${BUILD_ANDROID:-0}"
ANDROID_API_BASE_URL="${ANDROID_API_BASE_URL:-http://${ECS_HOST}:${DEPLOY_PORT}}"
APP_STORAGE_MODE_EXPLICIT="${APP_STORAGE_MODE+x}"
ALIYUN_OSS_ENDPOINT_EXPLICIT="${ALIYUN_OSS_ENDPOINT+x}"
ALIYUN_OSS_BUCKET_EXPLICIT="${ALIYUN_OSS_BUCKET+x}"
APP_STORAGE_MODE="${APP_STORAGE_MODE:-local}"
ALIYUN_OSS_ENDPOINT="${ALIYUN_OSS_ENDPOINT:-}"
ALIYUN_OSS_BUCKET="${ALIYUN_OSS_BUCKET:-}"
ALIYUN_OSS_OBJECT_PREFIX="${ALIYUN_OSS_OBJECT_PREFIX:-baby-companion}"
ALIYUN_OSS_ACCESS_KEY_ID_FILE="${ALIYUN_OSS_ACCESS_KEY_ID_FILE:-${REMOTE_CONFIG_DIR}/aliyun_oss_access_key_id}"
ALIYUN_OSS_ACCESS_KEY_SECRET_FILE="${ALIYUN_OSS_ACCESS_KEY_SECRET_FILE:-${REMOTE_CONFIG_DIR}/aliyun_oss_access_key_secret}"
ALIYUN_OSS_SIGNED_URL_TTL_SECONDS="${ALIYUN_OSS_SIGNED_URL_TTL_SECONDS:-86400}"
ALIYUN_OSS_MIGRATE_LOCAL_ON_STARTUP="${ALIYUN_OSS_MIGRATE_LOCAL_ON_STARTUP:-false}"
ANDROID_STUDIO_JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
INTELLIJ_MAVEN="/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn"
SSH_KEY="${SSH_KEY:-}"

usage() {
  cat <<EOF
Usage:
  ECS_HOST=<public-ip> scripts/deploy-aliyun-ecs.sh
  scripts/deploy-aliyun-ecs.sh <public-ip>

Options:
  ECS_USER=root                     SSH user.
  SSH_KEY=~/.ssh/aliyun.pem          Optional private key.
  ECS_PORT=22                        SSH port.
  DEPLOY_PORT=8300                   Backend HTTP port.
  SYNC_DATA=0                        Upload backend/data on first deploy. Default 0 — set 1 explicitly only on a fresh ECS where local data should seed the remote SQLite.
  SYNC_MOBILE_UPDATES=0              Upload backend/data/mobile-updates without syncing SQLite data.
  SYNC_MOBILE_UPDATE_MANIFEST_ONLY=0 Upload only the OTA manifest when bundles are hosted externally.
  OVERWRITE_REMOTE_DATA=0            Refuse to overwrite an existing remote SQLite file.
  SKIP_KEY_CHECK=0                   Require remote API key files before starting service.
  BUILD_ANDROID=0                    Also build Android debug APK with the public API URL.
  ANDROID_API_BASE_URL=http://ip:8300 Override APK API base URL.
  APP_STORAGE_MODE=local|oss          Backend attachment storage mode. If omitted, preserve the
                                      existing remote service value when present; first deploy defaults to local.
  ALIYUN_OSS_ENDPOINT=...             OSS endpoint when APP_STORAGE_MODE=oss.
  ALIYUN_OSS_BUCKET=...               OSS bucket when APP_STORAGE_MODE=oss.
  ALIYUN_OSS_OBJECT_PREFIX=...        OSS object key prefix.
  ALIYUN_OSS_MIGRATE_LOCAL_ON_STARTUP=true
                                      Upload existing local attachment files to OSS during startup.

Remote key files expected:
  ${REMOTE_CONFIG_DIR}/deepseek_apikey
  ${REMOTE_CONFIG_DIR}/doubao_apikey
  ${REMOTE_CONFIG_DIR}/doubao_asr_key
  ${REMOTE_CONFIG_DIR}/aliyun_oss_access_key_id       when APP_STORAGE_MODE=oss
  ${REMOTE_CONFIG_DIR}/aliyun_oss_access_key_secret   when APP_STORAGE_MODE=oss
EOF
}

if [[ "$ECS_HOST" == "-h" || "$ECS_HOST" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "$ECS_HOST" ]]; then
  usage
  exit 1
fi

ssh_args=(-p "$ECS_PORT")
scp_args=(-P "$ECS_PORT")
if [[ -n "$SSH_KEY" ]]; then
  ssh_args+=(-i "$SSH_KEY")
  scp_args+=(-i "$SSH_KEY")
fi

remote() {
  ssh "${ssh_args[@]}" "$ECS_USER@$ECS_HOST" "$@"
}

copy_to_remote() {
  scp "${scp_args[@]}" "$1" "$ECS_USER@$ECS_HOST:$2"
}

preserve_remote_storage_config() {
  if [[ -n "$APP_STORAGE_MODE_EXPLICIT" && -n "$ALIYUN_OSS_ENDPOINT_EXPLICIT" && -n "$ALIYUN_OSS_BUCKET_EXPLICIT" ]]; then
    return
  fi

  local remote_environment
  remote_environment="$(remote "systemctl show '$SERVICE_NAME' -p Environment --value 2>/dev/null || true")"
  [[ -n "$remote_environment" ]] || return

  local entry key value
  for entry in $remote_environment; do
    key="${entry%%=*}"
    value="${entry#*=}"
    case "$key" in
      APP_STORAGE_MODE)
        [[ -n "$APP_STORAGE_MODE_EXPLICIT" ]] || APP_STORAGE_MODE="$value"
        ;;
      ALIYUN_OSS_ENDPOINT)
        [[ -n "$ALIYUN_OSS_ENDPOINT_EXPLICIT" ]] || ALIYUN_OSS_ENDPOINT="$value"
        ;;
      ALIYUN_OSS_BUCKET)
        [[ -n "$ALIYUN_OSS_BUCKET_EXPLICIT" ]] || ALIYUN_OSS_BUCKET="$value"
        ;;
    esac
  done
}

preserve_remote_storage_config

if [[ "$APP_STORAGE_MODE" == "oss" ]]; then
  missing_oss_config=0
  if [[ -z "$ALIYUN_OSS_ENDPOINT" ]]; then
    echo "ALIYUN_OSS_ENDPOINT is required when APP_STORAGE_MODE=oss." >&2
    missing_oss_config=1
  fi
  if [[ -z "$ALIYUN_OSS_BUCKET" ]]; then
    echo "ALIYUN_OSS_BUCKET is required when APP_STORAGE_MODE=oss." >&2
    missing_oss_config=1
  fi
  if [[ "$missing_oss_config" == "1" ]]; then
    exit 1
  fi
fi

java_major_version() {
  local java_bin="$1"
  local version

  version="$("$java_bin" -version 2>&1 | awk -F\" '/version/ {print $2; exit}')"
  if [[ "$version" == 1.* ]]; then
    echo "$version" | cut -d. -f2
  else
    echo "$version" | cut -d. -f1
  fi
}

use_java_home() {
  local candidate="$1"

  if [[ -x "$candidate/bin/java" ]]; then
    local major
    major="$(java_major_version "$candidate/bin/java")"
    if [[ "$major" =~ ^[0-9]+$ && "$major" -ge 17 ]]; then
      export JAVA_HOME="$candidate"
      export PATH="$JAVA_HOME/bin:$PATH"
      echo "Using Java $major from $JAVA_HOME"
      return 0
    fi
  fi

  return 1
}

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

  echo "Maven was not found. Set MAVEN_BIN to a Maven 3.6+ executable." >&2
  exit 1
}

if [[ "$SKIP_BACKEND_BUILD" != "1" ]]; then
  if [[ -n "${JAVA_HOME:-}" ]]; then
    use_java_home "$JAVA_HOME" || true
  fi
  if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" || "$(java_major_version "$JAVA_HOME/bin/java")" -lt 17 ]]; then
    use_java_home "$ANDROID_STUDIO_JBR" || {
      echo "Backend build requires Java 17 or newer."
      echo "Install JDK 17+ or set JAVA_HOME, then retry."
      exit 1
    }
  fi

  MAVEN_BIN="$(resolve_maven)"
  echo "Building backend JAR..."
  (cd "$BACKEND_DIR" && "$MAVEN_BIN" -DskipTests package)
fi

JAR_PATH="$(find "$BACKEND_DIR/target" -maxdepth 1 -type f -name 'baby-companion-backend-*.jar' ! -name '*.original' | sort | tail -n 1)"
if [[ -z "$JAR_PATH" || ! -f "$JAR_PATH" ]]; then
  echo "Backend JAR was not found under $BACKEND_DIR/target."
  exit 1
fi

echo "Preparing ECS host $ECS_USER@$ECS_HOST..."
remote "SERVICE_NAME='$SERVICE_NAME' REMOTE_USER='$REMOTE_USER' REMOTE_APP_DIR='$REMOTE_APP_DIR' REMOTE_DATA_DIR='$REMOTE_DATA_DIR' REMOTE_CONFIG_DIR='$REMOTE_CONFIG_DIR' bash -s" <<'REMOTE_INIT'
set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

if command -v apt-get >/dev/null 2>&1; then
  $SUDO apt-get update
  $SUDO apt-get install -y openjdk-17-jre-headless curl rsync
elif command -v dnf >/dev/null 2>&1; then
  $SUDO dnf install -y java-17-openjdk-headless curl rsync
elif command -v yum >/dev/null 2>&1; then
  $SUDO yum install -y java-17-openjdk-headless curl rsync
else
  command -v java >/dev/null 2>&1 || {
    echo "No supported package manager found. Install Java 17 and rsync manually."
    exit 1
  }
fi

if ! id "$REMOTE_USER" >/dev/null 2>&1; then
  $SUDO useradd -r -m -d "$REMOTE_APP_DIR" -s /usr/sbin/nologin "$REMOTE_USER" 2>/dev/null \
    || $SUDO useradd -r -m -d "$REMOTE_APP_DIR" -s /sbin/nologin "$REMOTE_USER"
fi

$SUDO mkdir -p "$REMOTE_APP_DIR" "$REMOTE_DATA_DIR/auth" "$REMOTE_CONFIG_DIR"
$SUDO chown -R "$REMOTE_USER:$REMOTE_USER" "$REMOTE_APP_DIR" "$REMOTE_DATA_DIR"
$SUDO chown "root:$REMOTE_USER" "$REMOTE_CONFIG_DIR"
$SUDO chmod 750 "$REMOTE_CONFIG_DIR"
$SUDO chmod 700 "$REMOTE_DATA_DIR/auth"
REMOTE_INIT

echo "Uploading backend JAR..."
copy_to_remote "$JAR_PATH" "/tmp/${SERVICE_NAME}.jar"
remote "SERVICE_NAME='$SERVICE_NAME' REMOTE_USER='$REMOTE_USER' REMOTE_APP_DIR='$REMOTE_APP_DIR' bash -s" <<'REMOTE_JAR'
set -euo pipefail
if [[ "$(id -u)" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi
$SUDO mv "/tmp/${SERVICE_NAME}.jar" "$REMOTE_APP_DIR/app.jar"
$SUDO chown "$REMOTE_USER:$REMOTE_USER" "$REMOTE_APP_DIR/app.jar"
$SUDO chmod 640 "$REMOTE_APP_DIR/app.jar"
REMOTE_JAR

LOCAL_DATA_DIR="$BACKEND_DIR/data"
if [[ "$SYNC_DATA" == "1" && -d "$LOCAL_DATA_DIR" ]]; then
  remote_has_db="$(remote "test -f '$REMOTE_DATA_DIR/baby-companion.sqlite' && echo yes || echo no")"
  if [[ "$remote_has_db" == "yes" && "$OVERWRITE_REMOTE_DATA" != "1" ]]; then
    echo "Remote SQLite already exists; skipping data sync."
    echo "Set OVERWRITE_REMOTE_DATA=1 only if you intentionally want to copy local data over it."
  else
    if [[ -t 0 && -t 1 ]]; then
      echo
      echo "About to copy local backend/data to remote $ECS_USER@$ECS_HOST:$REMOTE_DATA_DIR."
      if [[ "$remote_has_db" == "yes" ]]; then
        echo "Remote SQLite at $REMOTE_DATA_DIR/baby-companion.sqlite WILL BE OVERWRITTEN."
      fi
      read -rp "Type 'yes' to continue: " confirm
      if [[ "$confirm" != "yes" ]]; then
        echo "Aborted by user." >&2
        exit 1
      fi
    fi
    echo "Uploading local backend/data to remote persistent directory..."
    rsync -az -e "ssh ${ssh_args[*]}" "$LOCAL_DATA_DIR"/ "$ECS_USER@$ECS_HOST:/tmp/${SERVICE_NAME}-data/"
    remote "SERVICE_NAME='$SERVICE_NAME' REMOTE_USER='$REMOTE_USER' REMOTE_DATA_DIR='$REMOTE_DATA_DIR' bash -s" <<'REMOTE_DATA'
set -euo pipefail
if [[ "$(id -u)" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi
$SUDO rsync -a "/tmp/${SERVICE_NAME}-data/" "$REMOTE_DATA_DIR/"
$SUDO chown -R "$REMOTE_USER:$REMOTE_USER" "$REMOTE_DATA_DIR"
REMOTE_DATA
  fi
fi

LOCAL_UPDATE_DIR="$LOCAL_DATA_DIR/mobile-updates"
if [[ "$SYNC_MOBILE_UPDATES" == "1" && -d "$LOCAL_UPDATE_DIR" ]]; then
  # 护栏(2026-06-14):推 manifest 到生产前,确认下载会走 OSS。后端 resolveBundleUrl 的回退
  # 顺序是 ossObjectKey → url(oss://) → url(http) → 后端单机直供 zip(慢)。最后一档正是
  # 「漏跑 upload-mobile-update-oss.sh → ossObjectKey 空 → OTA 静默变慢」的故障点,这里硬卡死。
  # 确需后端直供(本地/无 OSS 环境)显式设 ALLOW_BACKEND_DIRECT_OTA=1 放行。
  ALLOW_BACKEND_DIRECT_OTA="${ALLOW_BACKEND_DIRECT_OTA:-0}"
  if [[ -f "$LOCAL_UPDATE_DIR/manifest.json" ]]; then
    OTA_DELIVERY="$(node -e "const fs=require('node:fs');const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const k=((m.ossObjectKey||'')+'').trim();const u=((m.url||'')+'').trim();process.stdout.write(k?'oss':(u.startsWith('oss://')?'oss':(u?'external-url':'backend-direct')));" "$LOCAL_UPDATE_DIR/manifest.json" 2>/dev/null || echo parse-error)"
    if [[ "$OTA_DELIVERY" == "oss" || "$OTA_DELIVERY" == "external-url" ]]; then
      echo "OTA 下载来源校验通过:$OTA_DELIVERY ✓"
    elif [[ "$ALLOW_BACKEND_DIRECT_OTA" == "1" ]]; then
      echo "WARN: OTA manifest 无 OSS/外链地址($OTA_DELIVERY),将走后端单机直供(慢);ALLOW_BACKEND_DIRECT_OTA=1 已放行。" >&2
    else
      echo "ERROR: OTA manifest 的 ossObjectKey 为空($OTA_DELIVERY)—— 后端会回退到单机直供 zip,下载很慢。" >&2
      echo "       多半是漏跑了 OSS 上传步骤。先执行:" >&2
      echo "         ECS_HOST=$ECS_HOST SSH_KEY=\$HOME/.ssh/ai_baby_aliyun scripts/upload-mobile-update-oss.sh" >&2
      echo "       再重跑本同步;确需后端直供(无 OSS)显式设 ALLOW_BACKEND_DIRECT_OTA=1。" >&2
      exit 1
    fi
  fi
  if [[ "$SYNC_MOBILE_UPDATE_MANIFEST_ONLY" == "1" ]]; then
    if [[ ! -f "$LOCAL_UPDATE_DIR/manifest.json" ]]; then
      echo "Mobile update manifest was not found under $LOCAL_UPDATE_DIR." >&2
      exit 1
    fi
    echo "Uploading mobile update manifest to remote persistent directory..."
    copy_to_remote "$LOCAL_UPDATE_DIR/manifest.json" "/tmp/${SERVICE_NAME}-mobile-update-manifest.json"
    remote "SERVICE_NAME='$SERVICE_NAME' REMOTE_USER='$REMOTE_USER' REMOTE_DATA_DIR='$REMOTE_DATA_DIR' bash -s" <<'REMOTE_MOBILE_UPDATE_MANIFEST'
set -euo pipefail
if [[ "$(id -u)" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi
$SUDO mkdir -p "$REMOTE_DATA_DIR/mobile-updates"
$SUDO mv "/tmp/${SERVICE_NAME}-mobile-update-manifest.json" "$REMOTE_DATA_DIR/mobile-updates/manifest.json"
$SUDO chown "$REMOTE_USER:$REMOTE_USER" "$REMOTE_DATA_DIR/mobile-updates/manifest.json"
REMOTE_MOBILE_UPDATE_MANIFEST
  else
    echo "Uploading mobile update bundles to remote persistent directory..."
    rsync -az -e "ssh ${ssh_args[*]}" "$LOCAL_UPDATE_DIR"/ "$ECS_USER@$ECS_HOST:/tmp/${SERVICE_NAME}-mobile-updates/"
    remote "SERVICE_NAME='$SERVICE_NAME' REMOTE_USER='$REMOTE_USER' REMOTE_DATA_DIR='$REMOTE_DATA_DIR' bash -s" <<'REMOTE_MOBILE_UPDATES'
set -euo pipefail
if [[ "$(id -u)" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi
$SUDO mkdir -p "$REMOTE_DATA_DIR/mobile-updates"
$SUDO rsync -a "/tmp/${SERVICE_NAME}-mobile-updates/" "$REMOTE_DATA_DIR/mobile-updates/"
$SUDO chown -R "$REMOTE_USER:$REMOTE_USER" "$REMOTE_DATA_DIR/mobile-updates"
REMOTE_MOBILE_UPDATES
  fi
fi

if [[ "$SKIP_KEY_CHECK" != "1" ]]; then
  echo "Checking remote API key files..."
  remote "REMOTE_USER='$REMOTE_USER' REMOTE_CONFIG_DIR='$REMOTE_CONFIG_DIR' APP_STORAGE_MODE='$APP_STORAGE_MODE' bash -s" <<'REMOTE_KEYS'
set -euo pipefail
if [[ "$(id -u)" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi
missing=0
for file in deepseek_apikey doubao_apikey doubao_asr_key; do
  if [[ ! -s "$REMOTE_CONFIG_DIR/$file" ]]; then
    echo "Missing or empty: $REMOTE_CONFIG_DIR/$file"
    missing=1
  fi
done
if [[ "${APP_STORAGE_MODE:-local}" == "oss" ]]; then
  for file in aliyun_oss_access_key_id aliyun_oss_access_key_secret; do
    if [[ ! -s "$REMOTE_CONFIG_DIR/$file" ]]; then
      echo "Missing or empty: $REMOTE_CONFIG_DIR/$file"
      missing=1
    fi
  done
fi
if [[ "$missing" == "1" ]]; then
  echo
  echo "Create the missing files on ECS, for example:"
  echo "  install -m 640 -o root -g $REMOTE_USER /dev/null $REMOTE_CONFIG_DIR/deepseek_apikey"
  echo "  nano $REMOTE_CONFIG_DIR/deepseek_apikey"
  exit 1
fi
for file in deepseek_apikey doubao_apikey doubao_asr_key; do
  $SUDO chown "root:$REMOTE_USER" "$REMOTE_CONFIG_DIR/$file"
  $SUDO chmod 640 "$REMOTE_CONFIG_DIR/$file"
done
if [[ "${APP_STORAGE_MODE:-local}" == "oss" ]]; then
  for file in aliyun_oss_access_key_id aliyun_oss_access_key_secret; do
    $SUDO chown "root:$REMOTE_USER" "$REMOTE_CONFIG_DIR/$file"
    $SUDO chmod 640 "$REMOTE_CONFIG_DIR/$file"
  done
fi
REMOTE_KEYS
fi

echo "Installing systemd service..."
remote "SERVICE_NAME='$SERVICE_NAME' REMOTE_USER='$REMOTE_USER' REMOTE_APP_DIR='$REMOTE_APP_DIR' REMOTE_DATA_DIR='$REMOTE_DATA_DIR' REMOTE_CONFIG_DIR='$REMOTE_CONFIG_DIR' DEPLOY_PORT='$DEPLOY_PORT' ECS_HOST='$ECS_HOST' APP_STORAGE_MODE='$APP_STORAGE_MODE' ALIYUN_OSS_ENDPOINT='$ALIYUN_OSS_ENDPOINT' ALIYUN_OSS_BUCKET='$ALIYUN_OSS_BUCKET' ALIYUN_OSS_OBJECT_PREFIX='$ALIYUN_OSS_OBJECT_PREFIX' ALIYUN_OSS_ACCESS_KEY_ID_FILE='$ALIYUN_OSS_ACCESS_KEY_ID_FILE' ALIYUN_OSS_ACCESS_KEY_SECRET_FILE='$ALIYUN_OSS_ACCESS_KEY_SECRET_FILE' ALIYUN_OSS_SIGNED_URL_TTL_SECONDS='$ALIYUN_OSS_SIGNED_URL_TTL_SECONDS' ALIYUN_OSS_MIGRATE_LOCAL_ON_STARTUP='$ALIYUN_OSS_MIGRATE_LOCAL_ON_STARTUP' bash -s" <<'REMOTE_SERVICE'
set -euo pipefail
if [[ "$(id -u)" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi
JAVA_BIN="$(command -v java)"
CORS_ORIGINS="http://localhost:5173,http://localhost,capacitor://localhost,http://${ECS_HOST}:${DEPLOY_PORT}"

$SUDO tee "/etc/systemd/system/${SERVICE_NAME}.service" >/dev/null <<SERVICE
[Unit]
Description=AI Baby Growth Companion Backend
After=network-online.target
Wants=network-online.target

[Service]
User=${REMOTE_USER}
WorkingDirectory=${REMOTE_APP_DIR}
ExecStart=${JAVA_BIN} -jar ${REMOTE_APP_DIR}/app.jar
Restart=always
RestartSec=5

Environment=PORT=${DEPLOY_PORT}
Environment=APP_DATA_DIR=${REMOTE_DATA_DIR}
Environment=AUTH_JWT_SECRET_FILE=${REMOTE_DATA_DIR}/auth/jwt_secret
Environment=AUTH_INVITE_CODES_FILE=${REMOTE_DATA_DIR}/auth/invite_codes
Environment=DEEPSEEK_API_KEY_FILE=${REMOTE_CONFIG_DIR}/deepseek_apikey
Environment=DOUBAO_API_KEY_FILE=${REMOTE_CONFIG_DIR}/doubao_apikey
Environment=DOUBAO_ASR_API_KEY_FILE=${REMOTE_CONFIG_DIR}/doubao_asr_key
Environment=APP_CORS_ALLOWED_ORIGINS=${CORS_ORIGINS}
Environment=APP_MOBILE_UPDATES_PUBLIC_BASE_URL=http://${ECS_HOST}:${DEPLOY_PORT}
Environment=APP_STORAGE_MODE=${APP_STORAGE_MODE}
Environment=ALIYUN_OSS_ENDPOINT=${ALIYUN_OSS_ENDPOINT}
Environment=ALIYUN_OSS_BUCKET=${ALIYUN_OSS_BUCKET}
Environment=ALIYUN_OSS_OBJECT_PREFIX=${ALIYUN_OSS_OBJECT_PREFIX}
Environment=ALIYUN_OSS_ACCESS_KEY_ID_FILE=${ALIYUN_OSS_ACCESS_KEY_ID_FILE}
Environment=ALIYUN_OSS_ACCESS_KEY_SECRET_FILE=${ALIYUN_OSS_ACCESS_KEY_SECRET_FILE}
Environment=ALIYUN_OSS_SIGNED_URL_TTL_SECONDS=${ALIYUN_OSS_SIGNED_URL_TTL_SECONDS}
Environment=ALIYUN_OSS_MIGRATE_LOCAL_ON_STARTUP=${ALIYUN_OSS_MIGRATE_LOCAL_ON_STARTUP}

[Install]
WantedBy=multi-user.target
SERVICE

$SUDO systemctl daemon-reload
$SUDO systemctl enable --now "$SERVICE_NAME"
$SUDO systemctl restart "$SERVICE_NAME"
REMOTE_SERVICE

echo "Waiting for health check..."
for attempt in {1..30}; do
  if curl -fsS "http://${ECS_HOST}:${DEPLOY_PORT}/api/health" >/dev/null; then
    echo "Backend is healthy: http://${ECS_HOST}:${DEPLOY_PORT}/api/health"
    break
  fi
  if [[ "$attempt" == "30" ]]; then
    echo "Health check failed. Recent service logs:"
    remote "journalctl -u '$SERVICE_NAME' -n 120 --no-pager" || true
    exit 1
  fi
  sleep 2
done

if [[ "$BUILD_ANDROID" == "1" ]]; then
  echo "Building Android debug APK with VITE_AGENT_API_BASE_URL=$ANDROID_API_BASE_URL..."
  (cd "$ROOT_DIR" && VITE_AGENT_API_BASE_URL="$ANDROID_API_BASE_URL" npm run build:android:debug)
fi

cat <<EOF

Deployment finished.

Backend:
  http://${ECS_HOST}:${DEPLOY_PORT}

Health:
  http://${ECS_HOST}:${DEPLOY_PORT}/api/health

Build Android APK for this backend:
  VITE_AGENT_API_BASE_URL=http://${ECS_HOST}:${DEPLOY_PORT} npm run build:android:debug

View logs:
  ssh ${ECS_USER}@${ECS_HOST} 'journalctl -u ${SERVICE_NAME} -f'
EOF
