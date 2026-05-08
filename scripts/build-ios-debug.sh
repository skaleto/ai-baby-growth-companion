#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

npm run build
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
