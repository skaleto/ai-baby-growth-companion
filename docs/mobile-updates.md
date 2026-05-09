# Mobile Web OTA Updates

This app keeps the normal Capacitor bundled `dist` assets as the offline fallback. On native Android/iOS startup, the app:

1. Calls `CapacitorUpdater.notifyAppReady()` immediately so a broken downloaded bundle can roll back.
2. Checks `POST /api/mobile-updates/check` in the background.
3. Downloads the returned zip bundle when a newer web version is available.
4. Queues it with `CapacitorUpdater.next(...)`, so it applies after the app backgrounds or restarts.

## What Can Be Updated

- React UI and page logic under `src/`.
- CSS and visual layout under `src/styles.css`.
- Text copy and frontend-only interaction changes.
- Agent display logic, album display logic, reminder display logic.

## What Still Needs A New Native Package

- Android/iOS native code, permissions, app icon, splash screen, package name.
- New Capacitor plugins or plugin version changes.
- `capacitor.config.ts` changes that must be embedded in native assets.
- Native alarm activity/plugin changes.

## Build A Bundle

```bash
MOBILE_UPDATE_VERSION=0.1.1 npm run build:mobile:update
```

This writes:

- `backend/data/mobile-updates/manifest.json`
- `backend/data/mobile-updates/bundles/app-<version>.zip`

The zip must contain `index.html` at the root. The script checks this by zipping the built `dist/` contents directly.

## Publish To Aliyun

Use the existing deploy script without syncing SQLite data:

```bash
SYNC_DATA=0 \
SYNC_MOBILE_UPDATES=1 \
ECS_HOST=120.55.188.242 \
SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun \
scripts/deploy-aliyun-ecs.sh
```

The remote service reads bundles from:

```text
/var/lib/ai-baby-growth-companion/mobile-updates
```

The deploy script sets `APP_MOBILE_UPDATES_PUBLIC_BASE_URL` to `http://<host>:8300` for the systemd service. Use HTTPS and a domain before a public production release.
