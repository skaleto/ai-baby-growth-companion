# Custom Preview Video Player + Top Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native `<video controls>` in the fullscreen preview with a custom minimal player (center play/pause + thin seekable progress bar, autoplay-with-sound), add a top-left ✕ close button, and move the title/date·category to a top info bar.

**Architecture:** A new isolated `PreviewVideoPlayer` component renders a controls-less `<video>` plus a custom overlay, forwarding the video node to the existing `bindPreviewVideo` so its lifecycle (unmute, native-fullscreen-exit→close, pause-on-unbind) is preserved. Pure seek/progress math is extracted to a tiny testable module. App.tsx gains a persistent top bar (✕ + metadata) over the preview and swaps the two `<video controls>` usages for the new component.

**Tech Stack:** React 18 + TypeScript + Vite; lucide-react icons; pure-function tests via `scripts/*.mjs` (esbuild bundle + `node:assert/strict`).

**Important context for the executor:**
- `npm run build` = `tsc -p frontend/tsconfig.json && vite build ...`; this is the gate for `.tsx`/`.ts` changes.
- Pure-function tests are plain Node `.mjs` scripts that esbuild-bundle the TS source and assert with `node:assert/strict` (see `scripts/test-album-domain.mjs`). There is **no** Vitest/RTL — do not add one. React components are verified via `npm run build` + manual.
- The preview backdrop close handler ignores clicks inside `figcaption, video, button` ([App.tsx:2682](frontend/src/App.tsx#L2682)). Any **non-button** interactive element you add (progress bar, top bar container) MUST call `event.stopPropagation()` or it will close the preview.
- `X` is already imported from lucide-react in App.tsx (line 36). `albumCategoryLabel`, `formatFullDate`, `creatorMetaText`, `canCaregive`, `editAlbumItem`, `removeAlbumItem`, `bindPreviewVideo`, `closePreviewAttachment` are all already in scope in App.tsx.
- Preview CSS lives in `frontend/src/styles/app-base.css` (block starts at line 1129), NOT mobile-app.css.

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `frontend/src/components/previewVideoMath.ts` | Pure seek/progress math | **Create** |
| `scripts/test-preview-video-math.mjs` | Unit tests for the math | **Create** |
| `package.json` | Test script registration | **Modify** — add `test:preview-video-math`, append to `test:agent-l2:unit` |
| `frontend/src/components/PreviewVideoPlayer.tsx` | Custom video player component | **Create** |
| `frontend/src/App.tsx` | Preview top bar + ✕, swap videos, move metadata | **Modify** |
| `frontend/src/styles/app-base.css` | Top bar + close + player control styles | **Modify** |

---

## Task 1: Pure seek/progress math (TDD)

**Files:**
- Create: `frontend/src/components/previewVideoMath.ts`
- Create: `scripts/test-preview-video-math.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-preview-video-math.mjs`:

```js
#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-preview-video-math-"));
const bundlePath = path.join(tempDir, "previewVideoMath.mjs");

try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/components/previewVideoMath.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundlePath,
    logLevel: "silent",
  });

  const m = await import(pathToFileURL(bundlePath).href);

  assert.equal(typeof m.clamp01, "function", "clamp01 should be exported");
  assert.equal(typeof m.progressFraction, "function", "progressFraction should be exported");
  assert.equal(typeof m.seekTimeFromFraction, "function", "seekTimeFromFraction should be exported");
  assert.equal(typeof m.fractionFromPointer, "function", "fractionFromPointer should be exported");

  // clamp01
  assert.equal(m.clamp01(-0.5), 0);
  assert.equal(m.clamp01(1.5), 1);
  assert.equal(m.clamp01(0.3), 0.3);

  // progressFraction: currentTime / duration, clamped; 0 when duration invalid
  assert.equal(m.progressFraction(5, 10), 0.5);
  assert.equal(m.progressFraction(20, 10), 1, "overrun clamps to 1");
  assert.equal(m.progressFraction(5, 0), 0, "zero duration → 0");
  assert.equal(m.progressFraction(5, Number.NaN), 0, "NaN duration → 0");
  assert.equal(m.progressFraction(5, Infinity), 0, "infinite duration → 0");

  // seekTimeFromFraction: fraction * duration, clamped; 0 when duration invalid
  assert.equal(m.seekTimeFromFraction(0.5, 10), 5);
  assert.equal(m.seekTimeFromFraction(2, 10), 10, "over-1 fraction clamps");
  assert.equal(m.seekTimeFromFraction(-1, 10), 0, "negative fraction clamps");
  assert.equal(m.seekTimeFromFraction(0.5, 0), 0, "zero duration → 0");

  // fractionFromPointer: (clientX - left) / width, clamped
  assert.equal(m.fractionFromPointer(50, 0, 100), 0.5);
  assert.equal(m.fractionFromPointer(-10, 0, 100), 0, "left of bar clamps to 0");
  assert.equal(m.fractionFromPointer(150, 0, 100), 1, "right of bar clamps to 1");
  assert.equal(m.fractionFromPointer(60, 10, 100), 0.5, "honors left offset");
  assert.equal(m.fractionFromPointer(50, 0, 0), 0, "zero width → 0");

  console.log("preview video math tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node scripts/test-preview-video-math.mjs`
Expected: FAIL — esbuild cannot resolve `frontend/src/components/previewVideoMath.ts` (file does not exist yet) / module load error.

- [ ] **Step 3: Create the math module**

Create `frontend/src/components/previewVideoMath.ts`:

```ts
// Pure helpers for the custom preview video player's progress bar / seeking.
// Kept React-free so they can be unit-tested via scripts/test-preview-video-math.mjs.

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// Fraction (0..1) of playback completed. Returns 0 when duration is unknown/invalid.
export const progressFraction = (currentTime: number, duration: number): number => {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return clamp01(currentTime / duration);
};

// Target currentTime (seconds) for a 0..1 fraction. Returns 0 when duration is invalid.
export const seekTimeFromFraction = (fraction: number, duration: number): number => {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return clamp01(fraction) * duration;
};

// Convert a pointer x-coordinate over a bar (given its left/width) to a 0..1 fraction.
export const fractionFromPointer = (clientX: number, left: number, width: number): number => {
  if (!Number.isFinite(width) || width <= 0) return 0;
  return clamp01((clientX - left) / width);
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node scripts/test-preview-video-math.mjs`
Expected: PASS — prints `preview video math tests passed`.

- [ ] **Step 5: Register the test script in package.json**

In `package.json`, add a standalone script. Find this line:

```json
    "test:album-domain": "node scripts/test-album-domain.mjs",
```

Add immediately after it:

```json
    "test:preview-video-math": "node scripts/test-preview-video-math.mjs",
```

Then add it to the aggregate unit suite. Find the end of the `test:agent-l2:unit` value:

```
&& node scripts/test-capability-manifest.mjs",
```

Replace it with:

```
&& node scripts/test-capability-manifest.mjs && node scripts/test-preview-video-math.mjs",
```

- [ ] **Step 6: Verify the aggregate suite still runs**

Run: `npm run test:preview-video-math`
Expected: PASS — `preview video math tests passed`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/previewVideoMath.ts scripts/test-preview-video-math.mjs package.json
git commit -m "feat(preview): add pure seek/progress math for the video player

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `PreviewVideoPlayer` component

**Files:**
- Create: `frontend/src/components/PreviewVideoPlayer.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/PreviewVideoPlayer.tsx`:

```tsx
import { Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Attachment } from "../types";
import { fractionFromPointer, progressFraction, seekTimeFromFraction } from "./previewVideoMath";

const HIDE_DELAY_MS = 2500;

export function PreviewVideoPlayer({
  attachment,
  active,
  bindVideo,
}: {
  attachment: Attachment;
  active: boolean;
  bindVideo?: (node: HTMLVideoElement | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [fraction, setFraction] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Bind the internal ref AND forward to bindPreviewVideo (which sets muted=false,
  // wires native-fullscreen-exit → close, and pauses on unbind).
  const setVideoNode = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      bindVideo?.(node);
    },
    [bindVideo],
  );

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), HIDE_DELAY_MS);
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  // Autoplay with sound when active; pause + reset when inactive.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      setControlsVisible(true);
      void video
        .play()
        .then(() => scheduleHide())
        .catch(() => setControlsVisible(true));
    } else {
      video.pause();
      video.currentTime = 0;
      setFraction(0);
      setEnded(false);
    }
  }, [active, scheduleHide]);

  useEffect(
    () => () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    },
    [],
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (ended) {
      video.currentTime = 0;
      setEnded(false);
      void video.play().catch(() => {});
      return;
    }
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  }, [ended]);

  const seekToClientX = useCallback((clientX: number) => {
    const video = videoRef.current;
    const bar = barRef.current;
    if (!video || !bar) return;
    const rect = bar.getBoundingClientRect();
    const f = fractionFromPointer(clientX, rect.left, rect.width);
    video.currentTime = seekTimeFromFraction(f, video.duration);
    setFraction(f);
    setEnded(false);
  }, []);

  // Controls stay shown while paused/ended; auto-hide only while actively playing.
  const showControls = controlsVisible || !playing || ended;

  return (
    <div
      className={`preview-video-player${showControls ? " controls-visible" : ""}`}
      onClick={(event) => event.stopPropagation()}
    >
      <video
        ref={setVideoNode}
        src={attachment.url}
        poster={attachment.thumbnailUrl}
        playsInline
        preload="auto"
        aria-label={attachment.name}
        onClick={(event) => {
          event.stopPropagation();
          togglePlay();
          revealControls();
        }}
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setEnded(true);
          setPlaying(false);
          setControlsVisible(true);
        }}
        onTimeUpdate={(event) =>
          setFraction(progressFraction(event.currentTarget.currentTime, event.currentTarget.duration))
        }
      />
      <button
        type="button"
        className="preview-video-toggle"
        aria-label={ended ? "重播" : playing ? "暂停" : "播放"}
        onClick={(event) => {
          event.stopPropagation();
          togglePlay();
          revealControls();
        }}
      >
        {ended ? <RotateCcw size={28} /> : playing ? <Pause size={28} /> : <Play size={28} />}
      </button>
      <div
        ref={barRef}
        className="preview-video-progress"
        onPointerDown={(event) => {
          event.stopPropagation();
          draggingRef.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          seekToClientX(event.clientX);
          revealControls();
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current) return;
          event.stopPropagation();
          seekToClientX(event.clientX);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          draggingRef.current = false;
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="preview-video-progress-track" aria-hidden="true" />
        <div className="preview-video-progress-fill" style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check / build**

Run: `npm run build`
Expected: PASS. The component is exported but not yet imported anywhere — that is fine (no unused-import error for an exported symbol). Wiring happens in Task 3.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PreviewVideoPlayer.tsx
git commit -m "feat(preview): custom video player component (minimal controls, autoplay sound)

Controls-less <video> with center play/pause, thin seekable progress bar,
replay-on-end, auto-hide while playing. Forwards the node to bindPreviewVideo
to preserve unmute/native-fullscreen-exit/pause lifecycle.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Wire into the preview in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx` (import; top bar ~9437; carousel video ~9454; standalone video ~9488; bottom caption ~9513)

- [ ] **Step 1: Import the component**

In `frontend/src/App.tsx`, find the existing album component import:

```tsx
import { AlbumVideoThumbnail } from "./components/AlbumVideoThumbnail";
```

Add immediately after it:

```tsx
import { PreviewVideoPlayer } from "./components/PreviewVideoPlayer";
```

- [ ] **Step 2: Add the top bar + close button**

In `frontend/src/App.tsx`, find:

```tsx
        <div className={`media-preview ${previewMotion}`} role="dialog" aria-modal="true" aria-label="附件预览" onClick={handlePreviewClick}>
          <figure
```

Replace it with:

```tsx
        <div className={`media-preview ${previewMotion}`} role="dialog" aria-modal="true" aria-label="附件预览" onClick={handlePreviewClick}>
          <div className="media-preview-topbar" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="preview-close"
              aria-label="关闭"
              onClick={(event) => {
                event.stopPropagation();
                closePreviewAttachment();
              }}
            >
              <X size={20} />
            </button>
            {previewAlbumItem ? (
              <div className="media-preview-topinfo">
                <strong>{previewAlbumItem.title}</strong>
                <span>{formatFullDate(previewAlbumItem.date)} · {albumCategoryLabel(previewAlbumItem.category)}</span>
                {previewAlbumItem.recordedBy ? <small>{creatorMetaText(previewAlbumItem.recordedBy)}</small> : null}
              </div>
            ) : null}
          </div>
          <figure
```

- [ ] **Step 3: Swap the carousel (current-slide) video for the player**

In `frontend/src/App.tsx`, find this block inside the carousel map:

```tsx
                          attachment.kind === "video" ? (
                            <video
                              ref={isCurrent ? bindPreviewVideo : undefined}
                              src={attachment.url}
                              controls={isCurrent}
                              playsInline
                              poster={attachment.thumbnailUrl}
                              preload={isCurrent ? "auto" : "metadata"}
                              onClick={(event) => event.stopPropagation()}
                            />
                          ) : (
```

Replace it with:

```tsx
                          attachment.kind === "video" ? (
                            isCurrent ? (
                              <PreviewVideoPlayer attachment={attachment} active bindVideo={bindPreviewVideo} />
                            ) : (
                              <img src={attachment.thumbnailUrl || attachment.url} alt={attachment.name} draggable={false} />
                            )
                          ) : (
```

- [ ] **Step 4: Swap the standalone video for the player**

In `frontend/src/App.tsx`, find:

```tsx
            ) : previewAttachment.kind === "video" ? (
              <video
                ref={bindPreviewVideo}
                src={previewAttachment.url}
                controls
                playsInline
                poster={previewAttachment.thumbnailUrl}
                preload="auto"
                onClick={(event) => event.stopPropagation()}
              />
            ) : (
```

Replace it with:

```tsx
            ) : previewAttachment.kind === "video" ? (
              <PreviewVideoPlayer attachment={previewAttachment} active bindVideo={bindPreviewVideo} />
            ) : (
```

- [ ] **Step 5: Move descriptive metadata out of the bottom caption**

In `frontend/src/App.tsx`, find:

```tsx
              <figcaption className="media-preview-details" onClick={(event) => event.stopPropagation()}>
                <div className="media-preview-meta">
                  <strong>{previewAlbumItem.title}</strong>
                  <span>{formatFullDate(previewAlbumItem.date)} · {albumCategoryLabel(previewAlbumItem.category)}</span>
                  {previewAlbumItem.recordedBy ? <small>{creatorMetaText(previewAlbumItem.recordedBy)}</small> : null}
                </div>
                {previewAlbumItem.tags.length ? (
```

Replace it with (drops the `.media-preview-meta` block — it now lives in the top bar):

```tsx
              <figcaption className="media-preview-details" onClick={(event) => event.stopPropagation()}>
                {previewAlbumItem.tags.length ? (
```

- [ ] **Step 6: Type-check / build**

Run: `npm run build`
Expected: PASS (no TypeScript errors).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(preview): top bar with title/date + close button, use custom player

Adds a persistent top bar (✕ close + title/date·category/recorder) over the
preview, swaps native <video controls> for PreviewVideoPlayer (current slide
and standalone), shows posters for non-current carousel slides, and moves the
descriptive metadata from the bottom caption to the top bar.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Styles in app-base.css

**Files:**
- Modify: `frontend/src/styles/app-base.css` (preview block starts at line 1129)

- [ ] **Step 1: Add the top bar, close button, and player control styles**

In `frontend/src/styles/app-base.css`, find this rule (the first rule of the preview block):

```css
.media-preview {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  width: 100vw;
  max-width: 100vw;
  height: 100dvh;
  overflow: hidden;
  padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
  background: #05070a;
  animation: previewBackdropIn 180ms ease both;
  touch-action: none;
  overscroll-behavior: contain;
  -webkit-user-select: none;
  user-select: none;
}
```

Insert the following rules immediately **after** it:

```css
.media-preview-topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: calc(env(safe-area-inset-top) + 10px) 14px 22px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0));
  pointer-events: none;
}

.media-preview-topbar > * {
  pointer-events: auto;
}

.preview-close {
  flex: none;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  cursor: pointer;
  backdrop-filter: blur(6px);
}

.media-preview-topinfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding-top: 2px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.media-preview-topinfo strong {
  font-size: 15px;
  line-height: 1.25;
}

.media-preview-topinfo span {
  font-size: 12px;
  opacity: 0.85;
}

.media-preview-topinfo small {
  font-size: 11px;
  opacity: 0.7;
}

.preview-video-player {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.preview-video-toggle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.42);
  color: #fff;
  cursor: pointer;
  backdrop-filter: blur(8px);
  opacity: 0;
  visibility: hidden;
  transition: opacity 200ms ease;
}

.preview-video-player.controls-visible .preview-video-toggle {
  opacity: 1;
  visibility: visible;
}

.preview-video-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 30px;
  cursor: pointer;
  touch-action: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 200ms ease;
}

.preview-video-player.controls-visible .preview-video-progress {
  opacity: 1;
  visibility: visible;
}

.preview-video-progress-track {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 8px;
  height: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.3);
}

.preview-video-progress-fill {
  position: absolute;
  left: 0;
  bottom: 8px;
  height: 3px;
  border-radius: 999px;
  background: #fff;
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/app-base.css
git commit -m "style(preview): top bar, close button, and custom player controls

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the new unit tests**

Run: `npm run test:preview-video-math`
Expected: PASS — `preview video math tests passed`.

- [ ] **Step 2: Full type-check + production build**

Run: `npm run build`
Expected: PASS — no TypeScript errors, Vite build completes.

- [ ] **Step 3: Frontend smoke (if the environment supports Playwright)**

Run: `npm run smoke:frontend`
Expected: PASS. If the sandbox cannot run a browser, skip and note it — do not claim it passed.

- [ ] **Step 4: Manual checklist (dev server / device)**

Open a video in the album preview and confirm against the spec:
- Opens and **autoplays with sound**; native iOS video chrome is gone.
- Tapping the video toggles play/pause; the center button auto-hides while playing and reappears on tap.
- The thin bottom progress bar fills during playback and can be **dragged to seek**.
- Video **does not loop**; on end the center button shows a replay icon that restarts it.
- **Top-left ✕** closes the preview (present for both images and videos); backdrop tap / swipe-down / Esc still close.
- Top bar shows **title + date · category** (+ recorder if present); the bottom caption now shows only tags + edit/delete.
- Swiping left/right between album items still works; the swiped-away video pauses and resets; image pinch/zoom is unaffected.

- [ ] **Step 5: Commit any final tweaks**

If the manual pass required no changes, nothing to commit. Otherwise commit fixes and re-run Steps 1–2.

---

## Self-Review (completed by plan author)

- **Spec coverage:** §2 custom component (controls-less video, minimal controls, autoplay-sound, forward bindVideo) → Tasks 1+2; §3 top bar + ✕ + move metadata → Task 3 (steps 2,5) + Task 4; §4 integration (swap both videos, non-current poster) → Task 3 (steps 3,4); §5 CSS → Task 4; §6 tests → Task 1 + Task 5. All covered.
- **Placeholder scan:** No TBD/TODO; every code step has complete code; commands have expected output.
- **Type/name consistency:** `clamp01`, `progressFraction`, `seekTimeFromFraction`, `fractionFromPointer` defined in Task 1 and consumed identically in Task 2; `PreviewVideoPlayer` props `{attachment, active, bindVideo}` match both call sites in Task 3; CSS classes `preview-video-player`/`controls-visible`/`preview-video-toggle`/`preview-video-progress`/`preview-video-progress-track`/`preview-video-progress-fill`/`media-preview-topbar`/`preview-close`/`media-preview-topinfo` are used identically across Tasks 2–4.
- **Backdrop-close safety:** top bar container, progress bar, and player container all `stopPropagation`; ✕ and the toggle are `<button>`s (excluded by the close guard) and also stopPropagation. No new element can accidentally dismiss the preview.
- **Known minor behavior:** the `active` prop is always `true` at both call sites (the component only mounts for the current item); the inactive branch exists for safety/future preloading. Unmount still pauses via `bindPreviewVideo` cleanup. Not a blocker.
