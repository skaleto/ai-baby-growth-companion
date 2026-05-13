# Agent Notes

## Frontend Verification

This is a mobile-first React + Capacitor app. For any change that touches UI, visual styling, interaction behavior, mobile layout, or user-facing navigation, follow `docs/frontend-verification.md`.

Default gate:

```bash
npm run verify:frontend
```

The gate must cover build, local app launch, browser smoke, and mobile viewport observation at `360x740`, `390x844`, and `430x932`. Build success alone is not enough for UI work.

Escalate to `npm run mobile:sync` and the relevant native debug build when touching Capacitor config, `ios/`, `android/`, native plugins, permissions, media/file/audio/haptics/notification behavior, safe areas, keyboard behavior, or WebView-only logic.

If a required verification step cannot run, report the blocked step, reason, substitute checks, and remaining risk in the final handoff.
