# Mobile Web OTA Updates

This app keeps the normal Capacitor bundled `dist` assets as the offline fallback. On native Android/iOS startup, the app:

1. Calls `CapacitorUpdater.notifyAppReady()` immediately so a broken downloaded bundle can roll back.
2. Checks `POST /api/mobile-updates/check` in the background.
3. Downloads the returned zip bundle when a newer web version is available.
4. Queues it with `CapacitorUpdater.next(...)`, so it applies after the app backgrounds or restarts.

## What Can Be Updated

- React UI and page logic under `frontend/src/`.
- CSS and visual layout under `frontend/src/styles.css`.
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

The mobile update script builds with `VITE_BUILD_TARGET=mobile`, so website-only routes such as `/official` and their large landing assets are left out of the OTA bundle.

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

## Publish Bundle To OSS

For production, upload the zip to OSS/CDN and sync only the manifest back to ECS:

```bash
MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun \
scripts/upload-mobile-update-oss.sh

SYNC_DATA=0 \
SYNC_MOBILE_UPDATES=1 \
SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 \
ECS_HOST=120.55.188.242 \
SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun \
scripts/deploy-aliyun-ecs.sh
```

The OSS upload script reads the current bundle name from `backend/data/mobile-updates/manifest.json`, uploads that zip under `baby-companion/mobile-updates/`, and rewrites the manifest with an `ossObjectKey`. The backend signs a fresh temporary OSS download URL on every `/api/mobile-updates/check`, so the bucket can remain private.

> ⚠️ **下载来源护栏(2026-06-14)**：`deploy-aliyun-ecs.sh` 在同步 manifest 到生产前会校验下载来源。后端 `resolveBundleUrl` 的回退顺序是 `ossObjectKey → url(oss://) → url(http) → 后端单机直供 zip`。最后一档(`ossObjectKey` 与 `url` 都空)会让后端那台 ECS 自己吐 3.3M 的包,带宽小、多人抢 = **OTA 下载很慢**——历史上「漏跑 `upload-mobile-update-oss.sh` 就静默变慢」就是踩这里。所以**先 `upload-mobile-update-oss.sh` 再 sync 的顺序是硬要求**:manifest 没有 OSS/外链地址时同步会直接 `exit 1` 报错。确需后端直供(本地联调 / 无 OSS 环境)显式设 `ALLOW_BACKEND_DIRECT_OTA=1` 放行。
