# Album Masonry Layout + Video Autoplay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the album's square-crop grid with a date-ordered 2-column waterfall (masonry) that shows each photo/video at its true aspect ratio, and make album videos autoplay muted + looping when scrolled into view.

**Architecture:** Keep the existing per-group structure (`album-timeline → album-month-group → album-photo-grid`) and the existing grouping logic. Add pure layout helpers to `albumDomain.ts` (aspect-ratio resolution + greedy shortest-column distribution) that are unit-tested. In `App.tsx`, distribute each group's items into two columns and render each tile with a CSS `aspect-ratio` driven by the media's real dimensions (with a measure-on-load fallback). Rewrite `AlbumVideoThumbnail` to drive autoplay via an `IntersectionObserver`. Update CSS to a 2-column flex layout with aspect-ratio tiles and remove the video badge.

**Tech Stack:** React 18 + TypeScript + Vite; Capacitor (iOS/Android WKWebView); pure-function tests via `scripts/*.mjs` (esbuild bundle + `node:assert/strict`).

**Important context for the executor:**
- Tests for `albumDomain.ts` live in `scripts/test-album-domain.mjs`. Run with `node scripts/test-album-domain.mjs` or `npm run test:album-domain`. There is **no** Vitest/Jest and **no** React Testing Library — do not add one.
- Type-check + build the frontend with `npm run build` (runs `tsc -p frontend/tsconfig.json && vite build ...`). This is the gate for `.tsx` changes.
- The album groups by **calendar day** (`App.tsx` `albumGroups` uses `(item.occurredAt ?? item.date).slice(0,10)` + `albumDayLabel`). CSS class names contain "month" but the grouping is per-day. **Do not change the grouping** — masonry applies within each existing group.
- Custom CSS properties in inline styles use the existing pattern: `style={{ "--foo": value } as CSSProperties}` (`CSSProperties` is already imported in `App.tsx:45`).

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `frontend/src/albumDomain.ts` | Pure album domain logic | **Modify** — add `ALBUM_TILE_*` constants, `clampTileRatio`, `attachmentAspectRatio`, `distributeIntoColumns` |
| `scripts/test-album-domain.mjs` | Unit tests for album domain | **Modify** — add assertions for the new helpers |
| `frontend/src/components/AlbumVideoThumbnail.tsx` | Album video tile | **Rewrite** — IntersectionObserver-driven muted/looping autoplay + ratio reporting |
| `frontend/src/App.tsx` | Album screen rendering | **Modify** — column distribution + ratio-measurement state; replace grid render; remove badge |
| `frontend/src/styles/mobile-app.css` | Album styles | **Modify** — 2-column flex masonry, aspect-ratio tiles, remove badge style |

---

## Task 1: Pure layout helpers in `albumDomain.ts` (TDD)

**Files:**
- Modify: `frontend/src/albumDomain.ts`
- Test: `scripts/test-album-domain.mjs`

- [ ] **Step 1: Write the failing tests**

In `scripts/test-album-domain.mjs`, insert the following block immediately **before** the line `console.log("album domain tests passed");`:

```js
  // --- masonry layout helpers ---
  assert.equal(typeof album.clampTileRatio, "function", "clampTileRatio should be exported");
  assert.equal(typeof album.attachmentAspectRatio, "function", "attachmentAspectRatio should be exported");
  assert.equal(typeof album.distributeIntoColumns, "function", "distributeIntoColumns should be exported");

  // clampTileRatio bounds extreme width/height ratios into [0.5, 1.8]
  assert.equal(album.clampTileRatio(0.1), 0.5, "very tall ratio clamps to 0.5");
  assert.equal(album.clampTileRatio(5), 1.8, "very wide ratio clamps to 1.8");
  assert.equal(album.clampTileRatio(1), 1, "in-range ratio unchanged");

  // attachmentAspectRatio: width/height when present, else fallback; always clamped
  assert.equal(album.attachmentAspectRatio(imageAttachment({ width: 1000, height: 1000 })), 1);
  assert.equal(album.attachmentAspectRatio(imageAttachment({ width: 900, height: 1200 })), 0.75, "portrait 3:4 → 0.75");
  assert.equal(album.attachmentAspectRatio(imageAttachment({ width: 100, height: 1000 })), 0.5, "extreme tall clamps to 0.5");
  assert.equal(album.attachmentAspectRatio(undefined, 1.2), 1.2, "missing attachment uses provided fallback");
  assert.equal(album.attachmentAspectRatio(imageAttachment({ width: undefined, height: undefined })), 0.75, "missing dims use default 3:4");

  // distributeIntoColumns: greedy shortest-column, order preserved within each column
  const layoutItems = [
    { id: "a", ratio: 1 }, // height contribution 1.0
    { id: "b", ratio: 1 }, // 1.0
    { id: "c", ratio: 0.5 }, // 2.0 (tall)
    { id: "d", ratio: 1 }, // 1.0
  ];
  const cols = album.distributeIntoColumns(layoutItems, 2, (it) => it.ratio);
  assert.equal(cols.length, 2, "two columns");
  assert.deepEqual(cols[0].map((it) => it.id), ["a", "c"], "col0 greedy order");
  assert.deepEqual(cols[1].map((it) => it.id), ["b", "d"], "col1 greedy order");
  assert.deepEqual(cols.flat().map((it) => it.id).sort(), ["a", "b", "c", "d"], "no items lost");

  const single = album.distributeIntoColumns([{ id: "x", ratio: 1 }], 2, () => 1);
  assert.deepEqual(single[0].map((it) => it.id), ["x"], "single item goes to first column");
  assert.deepEqual(single[1], [], "second column empty");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node scripts/test-album-domain.mjs`
Expected: FAIL — first new assertion errors with `clampTileRatio should be exported` (the functions don't exist yet).

- [ ] **Step 3: Implement the helpers**

In `frontend/src/albumDomain.ts`, add the following exports. Place them immediately **after** the existing `attachmentListSrc` export (currently `frontend/src/albumDomain.ts:124`):

```ts
// Album tile aspect ratios are expressed as width / height.
// Clamp extremes so a panorama or a long screenshot can't produce a monster tile.
export const ALBUM_TILE_MIN_RATIO = 0.5; // tallest allowed (portrait)
export const ALBUM_TILE_MAX_RATIO = 1.8; // widest allowed (landscape)
export const ALBUM_TILE_DEFAULT_RATIO = 3 / 4; // 0.75, used when dimensions are unknown

export const clampTileRatio = (ratio: number) =>
  Math.min(ALBUM_TILE_MAX_RATIO, Math.max(ALBUM_TILE_MIN_RATIO, ratio));

export const attachmentAspectRatio = (
  attachment: Attachment | undefined,
  fallback: number = ALBUM_TILE_DEFAULT_RATIO,
): number => {
  const raw =
    attachment?.width && attachment?.height ? attachment.width / attachment.height : fallback;
  return clampTileRatio(raw);
};

// Distribute items (caller pre-sorts, e.g. newest first) into `columnCount` columns,
// greedily appending each item to the currently shortest column. Order within each
// column is preserved. Height contribution of an item is 1 / ratio (fixed column width).
export const distributeIntoColumns = <T>(
  items: T[],
  columnCount: number,
  ratioOf: (item: T) => number,
): T[][] => {
  const count = Math.max(1, columnCount);
  const columns: T[][] = Array.from({ length: count }, () => []);
  const heights = new Array<number>(count).fill(0);
  items.forEach((item) => {
    let target = 0;
    for (let index = 1; index < heights.length; index += 1) {
      if (heights[index] < heights[target]) target = index;
    }
    columns[target].push(item);
    const ratio = ratioOf(item) || 1;
    heights[target] += 1 / ratio;
  });
  return columns;
};
```

Note: `Attachment` is already imported in `albumDomain.ts` (it is used by existing helpers). Do not add a duplicate import.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node scripts/test-album-domain.mjs`
Expected: PASS — prints `album domain tests passed`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/albumDomain.ts scripts/test-album-domain.mjs
git commit -m "$(cat <<'EOF'
feat(album): add aspect-ratio + column-distribution helpers

clampTileRatio, attachmentAspectRatio, distributeIntoColumns power the
upcoming masonry layout. Greedy shortest-column packing keeps date order
within each column; ratios clamp to [0.5, 1.8].

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Rewrite `AlbumVideoThumbnail` for autoplay-on-visible

**Files:**
- Rewrite: `frontend/src/components/AlbumVideoThumbnail.tsx`

The current component shows only a static poster/first-frame. Replace it so the video autoplays muted + looping when ≥40% visible and pauses when scrolled away, reports its true aspect ratio via `onRatio`, and honors `prefers-reduced-motion` (poster only, no autoplay).

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `frontend/src/components/AlbumVideoThumbnail.tsx` with:

```tsx
import { Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Attachment } from "../types";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function AlbumVideoThumbnail({
  attachment,
  title,
  onRatio,
}: {
  attachment: Attachment;
  title: string;
  onRatio?: (ratio: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [canAutoplay] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !canAutoplay) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [canAutoplay]);

  if (!attachment.url) {
    return <Video size={24} />;
  }

  return (
    <video
      ref={videoRef}
      src={attachment.url}
      poster={attachment.thumbnailUrl}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={title}
      onLoadedMetadata={(event) => {
        const el = event.currentTarget;
        if (el.videoWidth && el.videoHeight) onRatio?.(el.videoWidth / el.videoHeight);
      }}
    />
  );
}
```

Key points (do not change):
- No `autoplay` attribute — play/pause is driven by the `IntersectionObserver` so off-screen videos never play.
- `muted + playsInline + programmatic play()` is required for inline playback in iOS WKWebView; the `play()` promise is caught and ignored if the platform rejects it.
- `poster={attachment.thumbnailUrl}` shows the generated thumbnail before the video paints (and in reduced-motion mode). If the thumbnail URL is broken, the video's own frame shows instead — acceptable.
- `onLoadedMetadata` reports real dimensions so the masonry layout can correct tiles for videos whose attachment lacks `width`/`height`.

- [ ] **Step 2: Type-check / build**

Run: `npm run build`
Expected: PASS (no TypeScript errors). The build also covers `App.tsx`, which still passes `AlbumVideoThumbnail` without `onRatio` (the prop is optional) — wiring happens in Task 3.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AlbumVideoThumbnail.tsx
git commit -m "$(cat <<'EOF'
feat(album): autoplay album videos muted when scrolled into view

AlbumVideoThumbnail now plays muted+looping via IntersectionObserver
(≥40% visible), pauses off-screen, reports true aspect ratio, and
respects prefers-reduced-motion (poster only).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Render 2-column masonry in `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx` (import block ~`60-74`; album state near `2980`; render block `8262-8297`)

- [ ] **Step 1: Import the new helpers**

In `App.tsx`, find the import from `./albumDomain` (begins at `App.tsx:60`). Add `attachmentAspectRatio` and `distributeIntoColumns` to that import list. After the edit the import list contains (among the existing names) these two new lines:

```ts
  attachmentAspectRatio,
  distributeIntoColumns,
```

(Place them alphabetically/near `attachmentListSrc` and the other named imports; exact position within the braces does not matter.)

- [ ] **Step 2: Add ratio-measurement state and a per-item aspect helper**

In `App.tsx`, immediately **after** the `albumPreviewItems` memo (ends at `App.tsx:2984`), add:

```ts
  const [albumRatioOverrides, setAlbumRatioOverrides] = useState<Record<string, number>>({});
  const recordAlbumRatio = useCallback((attachmentId: string, ratio: number) => {
    if (!attachmentId || !Number.isFinite(ratio) || ratio <= 0) return;
    setAlbumRatioOverrides((current) =>
      current[attachmentId] ? current : { ...current, [attachmentId]: ratio },
    );
  }, []);
  const albumTileAspect = useCallback(
    (item: AlbumItem) => {
      if (!item.attachment) return 1; // category-icon placeholder → square
      const measured = albumRatioOverrides[item.attachment.id];
      return attachmentAspectRatio(item.attachment, measured);
    },
    [albumRatioOverrides],
  );
```

Notes:
- `useState`, `useCallback`, and `useMemo` are already imported in `App.tsx`.
- `recordAlbumRatio` only writes the first measurement per attachment id (`current[attachmentId] ? current : ...`), preventing render loops and repeated redistribution.
- Passing `measured` (possibly `undefined`) as the `fallback` arg is intentional: `attachmentAspectRatio` uses the attachment's own `width/height` when present, otherwise the measured value, otherwise its built-in default (since a parameter receiving `undefined` falls back to its default).

- [ ] **Step 3: Replace the grid render with two columns**

In `App.tsx`, replace the current `.album-photo-grid` block (`App.tsx:8262-8297`), which currently is:

```tsx
                  <div className="album-photo-grid">
                    {group.items.map((item, itemIndex) => {
                      const attachment = item.attachment;
                      return (
                        <article
                          className={`album-photo-tile album-${item.category}`}
                          key={item.id}
                          style={{ "--tile-index": (groupIndex * 7 + itemIndex) % 18 } as CSSProperties}
                        >
                          <button
                            type="button"
                            className="album-photo-thumb"
                            onClick={() => {
                              if (!attachment?.url) return;
                              openPreviewAttachment(attachment, item);
                            }}
                            aria-label={`预览 ${item.title}`}
                            disabled={!attachment?.url}
                          >
                            {attachment?.kind === "video" ? (
                              <AlbumVideoThumbnail attachment={attachment} title={item.title} />
                            ) : attachment ? (
                              <img src={attachmentListSrc(attachment)} alt={item.title} loading="lazy" decoding="async" />
                            ) : (
                              <img src={albumCategoryIconSrc(item.category)} alt="" loading="lazy" decoding="async" />
                            )}
                            {attachment?.kind === "video" ? (
                              <span className="album-video-badge" aria-hidden="true">
                                <Video size={13} />
                              </span>
                            ) : null}
                          </button>
                        </article>
                      );
                    })}
                  </div>
```

with this (distributes into 2 columns, sets `--aspect`, wires ratio measurement, removes the badge):

```tsx
                  <div className="album-photo-grid">
                    {distributeIntoColumns(group.items, 2, albumTileAspect).map((column, columnIndex) => (
                      <div className="album-photo-column" key={columnIndex}>
                        {column.map((item, itemIndex) => {
                          const attachment = item.attachment;
                          return (
                            <article
                              className={`album-photo-tile album-${item.category}`}
                              key={item.id}
                              style={
                                {
                                  "--aspect": albumTileAspect(item),
                                  "--tile-index": (groupIndex * 7 + columnIndex * 3 + itemIndex) % 18,
                                } as CSSProperties
                              }
                            >
                              <button
                                type="button"
                                className="album-photo-thumb"
                                onClick={() => {
                                  if (!attachment?.url) return;
                                  openPreviewAttachment(attachment, item);
                                }}
                                aria-label={`预览 ${item.title}`}
                                disabled={!attachment?.url}
                              >
                                {attachment?.kind === "video" ? (
                                  <AlbumVideoThumbnail
                                    attachment={attachment}
                                    title={item.title}
                                    onRatio={(ratio) => recordAlbumRatio(attachment.id, ratio)}
                                  />
                                ) : attachment ? (
                                  <img
                                    src={attachmentListSrc(attachment)}
                                    alt={item.title}
                                    loading="lazy"
                                    decoding="async"
                                    onLoad={(event) => {
                                      const el = event.currentTarget;
                                      if (el.naturalWidth && el.naturalHeight)
                                        recordAlbumRatio(attachment.id, el.naturalWidth / el.naturalHeight);
                                    }}
                                  />
                                ) : (
                                  <img src={albumCategoryIconSrc(item.category)} alt="" loading="lazy" decoding="async" />
                                )}
                              </button>
                            </article>
                          );
                        })}
                      </div>
                    ))}
                  </div>
```

- [ ] **Step 4: Check `Video` import is still used**

The badge used `<Video size={13} />`. `Video` is still imported and used by `AlbumVideoThumbnail.tsx` (separate file) and may be used elsewhere in `App.tsx`. Run:

`grep -n "Video" frontend/src/App.tsx`

If `Video` is no longer referenced anywhere in `App.tsx`, remove it from the `lucide-react` import in `App.tsx` to avoid an unused-import build error. If it is still referenced, leave the import unchanged.

- [ ] **Step 5: Type-check / build**

Run: `npm run build`
Expected: PASS (no TypeScript errors).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(album): render media as date-ordered 2-column masonry

Each day group distributes its items into two balanced columns via
distributeIntoColumns; tiles size to real aspect ratio (--aspect) with a
measure-on-load fallback for legacy media. Drops the video badge.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Masonry CSS in `mobile-app.css`

**Files:**
- Modify: `frontend/src/styles/mobile-app.css` (`.album-photo-grid`/`.album-photo-tile`/`.album-photo-thumb` at `3301-3351`; `.album-video-badge` at `3353-3365`)

- [ ] **Step 1: Replace the grid/tile/thumb rules**

In `frontend/src/styles/mobile-app.css`, replace this block (`mobile-app.css:3301-3351`):

```css
.album-photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}

.album-photo-tile {
  position: relative;
  display: grid;
  gap: 6px;
  min-width: 0;
  animation: albumTileIn 520ms cubic-bezier(0.19, 1, 0.22, 1) both;
  animation-delay: calc(var(--tile-index, 0) * 28ms);
}

.album-photo-thumb {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  padding: 0;
  border: 1px solid rgba(234, 223, 208, 0.72);
  border-radius: 8px;
  background: #eef3ef;
  color: var(--muted);
  cursor: zoom-in;
  box-shadow: 0 8px 18px rgba(57, 45, 31, 0.06);
  transform-origin: center;
  transition:
    box-shadow 180ms ease,
    transform 180ms ease;
  will-change: transform;
}

.album-photo-thumb:active {
  transform: scale(0.965);
  box-shadow: 0 4px 10px rgba(57, 45, 31, 0.08);
}

.album-photo-thumb:disabled {
  cursor: default;
}

.album-photo-thumb img,
.album-photo-thumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

with:

```css
.album-photo-grid {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.album-photo-column {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.album-photo-tile {
  position: relative;
  min-width: 0;
  animation: albumTileIn 520ms cubic-bezier(0.19, 1, 0.22, 1) both;
  animation-delay: calc(var(--tile-index, 0) * 28ms);
}

.album-photo-thumb {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: var(--aspect, 0.75);
  overflow: hidden;
  padding: 0;
  border: 1px solid rgba(234, 223, 208, 0.72);
  border-radius: 8px;
  background: #eef3ef;
  color: var(--muted);
  cursor: zoom-in;
  box-shadow: 0 8px 18px rgba(57, 45, 31, 0.06);
  transform-origin: center;
  transition:
    box-shadow 180ms ease,
    transform 180ms ease;
  will-change: transform;
}

.album-photo-thumb:active {
  transform: scale(0.965);
  box-shadow: 0 4px 10px rgba(57, 45, 31, 0.08);
}

.album-photo-thumb:disabled {
  cursor: default;
}

.album-photo-thumb img,
.album-photo-thumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

The tile aspect ratio now follows `--aspect` (width/height) set per item; since the tile ratio matches the media ratio, `object-fit: cover` fills the tile with no visible crop (only clamped extremes crop slightly).

- [ ] **Step 2: Remove the video badge rule**

In `frontend/src/styles/mobile-app.css`, delete the entire `.album-video-badge` rule (`mobile-app.css:3353-3365`):

```css
.album-video-badge {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  color: #fff;
  background: rgba(31, 43, 38, 0.72);
  backdrop-filter: blur(6px);
}
```

- [ ] **Step 3: Confirm the badge class is fully gone**

Run: `grep -rn "album-video-badge" frontend/src`
Expected: no output (removed from both `App.tsx` in Task 3 and the CSS here).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/mobile-app.css
git commit -m "$(cat <<'EOF'
style(album): 2-column masonry CSS with aspect-ratio tiles

Album grid becomes a flex row of two columns; tiles size via
--aspect instead of forced 1:1. Removes the now-unused video badge.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the album domain unit tests**

Run: `npm run test:album-domain`
Expected: PASS — `album domain tests passed`.

- [ ] **Step 2: Full type-check + production build**

Run: `npm run build`
Expected: PASS — no TypeScript errors, Vite build completes.

- [ ] **Step 3: Frontend smoke (if the environment supports Playwright)**

Run: `npm run smoke:frontend`
Expected: PASS. If Chromium is missing, first run `npm run setup:frontend-smoke`. If the sandbox cannot run a browser, skip this step and note it in the completion summary — do not claim it passed.

- [ ] **Step 4: Manual visual checklist (dev server)**

Start dev server (`npm run dev`) and open the album tab. Confirm against the spec acceptance criteria:
- Media renders as a 2-column waterfall, grouped by day (newest day first), newest items at the top of each group.
- Photos and videos show at their true aspect ratio — no square crop, no letterbox bars (only extreme long/wide media is slightly cropped by the clamp).
- Videos autoplay muted + looping when scrolled into view and pause when scrolled away.
- Tapping a tile still opens the full-screen preview (with sound) — unchanged behavior.
- No video badge appears.
- Legacy media without stored dimensions settles to the correct aspect ratio after load (a single brief reflow is acceptable).
- With OS "reduce motion" enabled, videos do not autoplay (poster shown).

- [ ] **Step 5: Commit any final tweaks**

If the manual pass required no changes, there is nothing to commit. Otherwise commit fixes with a clear message and re-run Steps 1–2.

---

## Self-Review (completed by plan author)

- **Spec coverage:** §2 masonry → Tasks 1+3+4; §2.1 ratio source/fallback/clamp → Task 1 (`attachmentAspectRatio`, `clampTileRatio`) + Task 3 (measure-on-load) + Task 4 (`--aspect`); §2.2 fixed 2 columns → Task 3 (`distributeIntoColumns(..., 2, ...)`); §3 autoplay-on-visible/muted/loop/reduced-motion/badge removal → Task 2 + Task 3 + Task 4; §5 tests → Task 1 unit tests + Task 5 verification. All sections covered.
- **Placeholder scan:** No TBD/TODO; every code step contains complete code; commands have expected output.
- **Type/name consistency:** `clampTileRatio`, `attachmentAspectRatio`, `distributeIntoColumns`, `albumTileAspect`, `recordAlbumRatio`, `albumRatioOverrides`, `onRatio`, CSS var `--aspect`, class `.album-photo-column` are used identically across Tasks 1–4.
- **Known minor behavior:** When a legacy item's measured ratio changes its column assignment, React remounts that one article (it moves between column parents), which can briefly re-trigger its entrance animation / video metadata load. This happens at most once per legacy item and only for media lacking stored dimensions; accepted per spec §3.1. Not a blocker.
