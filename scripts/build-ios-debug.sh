#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# 移动包默认注入生产 base URL，避免 npm run build fallback 到 localhost:8080（参见 docs/ops/ota-incident-2026-06-05.md）。
# 指向本地后端开发时，显式设 VITE_AGENT_API_BASE_URL=http://localhost:8080。
API_BASE_URL="${VITE_AGENT_API_BASE_URL:-http://120.55.188.242:8300}"
echo "Building web assets with API base URL: ${API_BASE_URL}"
VITE_AGENT_API_BASE_URL="${API_BASE_URL}" npm run build
npx cap sync ios

IOS_SIMULATOR_DESTINATION="${IOS_SIMULATOR_DESTINATION:-platform=iOS Simulator,name=iPhone 17}"
echo "Building iOS debug app for simulator destination: ${IOS_SIMULATOR_DESTINATION}"

xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "${IOS_SIMULATOR_DESTINATION}" \
  CODE_SIGNING_ALLOWED=NO \
  build
