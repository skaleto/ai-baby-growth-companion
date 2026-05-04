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
SYNC_DATA="${SYNC_DATA:-1}"
OVERWRITE_REMOTE_DATA="${OVERWRITE_REMOTE_DATA:-0}"
SKIP_BACKEND_BUILD="${SKIP_BACKEND_BUILD:-0}"
SKIP_KEY_CHECK="${SKIP_KEY_CHECK:-0}"
BUILD_ANDROID="${BUILD_ANDROID:-0}"
ANDROID_API_BASE_URL="${ANDROID_API_BASE_URL:-http://${ECS_HOST}:${DEPLOY_PORT}}"
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
  SYNC_DATA=1                        Upload backend/data on first deploy.
  OVERWRITE_REMOTE_DATA=0            Refuse to overwrite an existing remote SQLite file.
  SKIP_KEY_CHECK=0                   Require remote API key files before starting service.
  BUILD_ANDROID=0                    Also build Android debug APK with the public API URL.
  ANDROID_API_BASE_URL=http://ip:8300 Override APK API base URL.

Remote key files expected:
  ${REMOTE_CONFIG_DIR}/deepseek_apikey
  ${REMOTE_CONFIG_DIR}/doubao_apikey
  ${REMOTE_CONFIG_DIR}/doubao_asr_key
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

if [[ "$SKIP_KEY_CHECK" != "1" ]]; then
  echo "Checking remote API key files..."
  remote "REMOTE_USER='$REMOTE_USER' REMOTE_CONFIG_DIR='$REMOTE_CONFIG_DIR' bash -s" <<'REMOTE_KEYS'
set -euo pipefail
if [[ "$(id -u)" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi
missing=0
for file in deepseek_apikey doubao_apikey doubao_asr_key; do
  if [[ ! -s "$REMOTE_CONFIG_DIR/$file" ]]; then
    echo "Missing or empty: $REMOTE_CONFIG_DIR/$file"
    missing=1
  fi
done
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
REMOTE_KEYS
fi

echo "Installing systemd service..."
remote "SERVICE_NAME='$SERVICE_NAME' REMOTE_USER='$REMOTE_USER' REMOTE_APP_DIR='$REMOTE_APP_DIR' REMOTE_DATA_DIR='$REMOTE_DATA_DIR' REMOTE_CONFIG_DIR='$REMOTE_CONFIG_DIR' DEPLOY_PORT='$DEPLOY_PORT' ECS_HOST='$ECS_HOST' bash -s" <<'REMOTE_SERVICE'
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
