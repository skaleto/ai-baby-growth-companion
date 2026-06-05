#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
ANDROID_STUDIO_JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

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

    if [[ "$major" =~ ^[0-9]+$ && "$major" -ge 11 ]]; then
      export JAVA_HOME="$candidate"
      export PATH="$JAVA_HOME/bin:$PATH"
      echo "Using Java $major from $JAVA_HOME"
      return 0
    fi
  fi

  return 1
}

if [[ -n "${JAVA_HOME:-}" ]]; then
  use_java_home "$JAVA_HOME" || true
fi

if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" || "$(java_major_version "$JAVA_HOME/bin/java")" -lt 11 ]]; then
  use_java_home "$ANDROID_STUDIO_JBR" || {
    echo "Android debug build requires Java 11 or newer."
    echo "Install Android Studio or set JAVA_HOME to a JDK 11+ path, then retry."
    exit 1
  }
fi

echo "Building web assets and syncing Capacitor..."
cd "$ROOT_DIR"
# 移动包默认注入生产 base URL，避免 mobile:sync 内部 npm run build fallback 到 localhost:8080（参见 docs/ops/ota-incident-2026-06-05.md）。
# 指向本地后端开发时，显式设 VITE_AGENT_API_BASE_URL=http://localhost:8080。
API_BASE_URL="${VITE_AGENT_API_BASE_URL:-http://120.55.188.242:8300}"
echo "Using API base URL: ${API_BASE_URL}"
VITE_AGENT_API_BASE_URL="${API_BASE_URL}" npm run mobile:sync

echo "Building Android debug APK..."
cd "$ANDROID_DIR"
./gradlew assembleDebug

echo "Debug APK built:"
echo "$APK_PATH"
