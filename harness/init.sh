#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
MODE="${1:---smoke}"

section() {
  printf '\n==> %s\n' "$1"
}

run() {
  printf '+'
  printf ' %q' "$@"
  printf '\n'
  "$@"
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
  local intellij_maven="/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn"

  if [[ -n "${MAVEN_BIN:-}" && -x "$MAVEN_BIN" ]]; then
    echo "$MAVEN_BIN"
    return
  fi

  if [[ -x "$intellij_maven" ]]; then
    echo "$intellij_maven"
    return
  fi

  if command -v mvn >/dev/null 2>&1; then
    command -v mvn
    return
  fi

  echo "Maven was not found. Set MAVEN_BIN to a Maven executable." >&2
  exit 1
}

run_backend_tests() {
  local android_studio_jbr="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  local intellij_jbr="/Applications/IntelliJ IDEA.app/Contents/jbr/Contents/Home"

  if [[ -n "${JAVA_HOME:-}" ]]; then
    use_java_home "$JAVA_HOME" || true
  fi

  if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" ]]; then
    use_java_home "$android_studio_jbr" || use_java_home "$intellij_jbr" || true
  fi

  if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" ]]; then
    echo "Backend tests require Java 17 or newer. Set JAVA_HOME and retry." >&2
    exit 1
  fi

  local major
  major="$(java_major_version "$JAVA_HOME/bin/java")"
  if [[ ! "$major" =~ ^[0-9]+$ || "$major" -lt 17 ]]; then
    echo "Backend tests require Java 17 or newer; current JAVA_HOME is Java $major." >&2
    exit 1
  fi

  local maven_bin
  maven_bin="$(resolve_maven)"
  run "$maven_bin" -q -f "$BACKEND_DIR/pom.xml" test
}

case "$MODE" in
  --smoke|--full|--cloud)
    ;;
  -h|--help)
    cat <<'EOF'
Usage:
  bash harness/init.sh          Run smoke gate.
  bash harness/init.sh --smoke  Run smoke gate.
  bash harness/init.sh --full   Run smoke gate plus frontend smoke and backend tests.
  bash harness/init.sh --cloud  Run smoke gate plus cloud E2E script.

Environment:
  MAVEN_BIN=/path/to/mvn        Optional Maven executable.
  HARNESS_SKIP_BUILD=1          Skip npm run build in smoke mode.
EOF
    exit 0
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    echo "Run bash harness/init.sh --help for usage." >&2
    exit 1
    ;;
esac

section "Repository"
cd "$ROOT_DIR"
echo "Root: $ROOT_DIR"
run git status --short
run git log --oneline -5

section "Whitespace check"
run git diff --check

section "Frontend build"
if [[ "${HARNESS_SKIP_BUILD:-0}" == "1" ]]; then
  echo "Skipped because HARNESS_SKIP_BUILD=1"
else
  run npm run build
fi

section "Agent benchmark"
run npm run test:agent-benchmark

if [[ "$MODE" == "--full" ]]; then
  section "Frontend verification"
  run npm run verify:frontend

  section "Backend tests"
  run_backend_tests
fi

if [[ "$MODE" == "--cloud" ]]; then
  section "Cloud feature E2E"
  run npm run test:cloud-e2e
fi

section "Done"
echo "Harness init completed in mode $MODE."
