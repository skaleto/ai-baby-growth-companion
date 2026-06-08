# Full-screen Lively AuthScene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the consent and all login/auth screens a full-screen lively CSS background (warm aurora + drifting soft blobs + a gently floating companion mark + twinkling stars) with the existing form/card restyled as a frosted-glass panel.

**Architecture:** A new `AuthScene` component renders the full-screen, viewport-fixed background (pure CSS, `aria-hidden`), placed as a **sibling before** the existing `.auth-panel` / `.consent-gate-card` so the panel's `backdrop-filter` can blur it. A new `auth-scene.css`, imported last, holds the scene styles plus higher-specificity glass overrides for the panels. No new image assets (reuses `companion.png`); no JS logic changes.

**Tech Stack:** React 18 + TypeScript + Vite; pure CSS (keyframes + `backdrop-filter`); `prefers-reduced-motion` honored.

**Important context for the executor:**
- `npm run build` is the gate for `.tsx`/CSS. `npm run smoke:frontend` must still pass — it waits for `.auth-panel` in the unauthenticated state, so **keep the `.auth-panel` class**.
- The scene is `position: fixed; inset: 0` and must be a **sibling** of the panel (not a child) — a glass panel cannot `backdrop-filter`-blur its own descendant.
- `styles.css` currently imports `consent.css` last; the new `auth-scene.css` must be imported **after** it so its overrides win at equal specificity. The override selectors (`.auth-shell .auth-panel`, `.consent-gate-backdrop .consent-gate-card`) are specificity (0,2,0) and beat the existing (0,1,0) rules in `mobile-app.css` / `warm-theme.css` / `consent.css`.
- There are **four** `<main className="app-shell auth-shell">` blocks in App.tsx (checking / unauthenticated / onboarding-viewer / onboarding-caregiver), each with a `<StorybookScene />` inside its `.auth-panel`. The onboarding blocks also use `companionIcon` for a brand-mark — leave that import in place.
- No unit tests apply (pure visual; repo has no RTL). Verify via build + smoke + manual.

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `frontend/src/components/AuthScene.tsx` | Full-screen lively background | **Create** |
| `frontend/src/styles/auth-scene.css` | Scene styles + glass panel overrides | **Create** |
| `frontend/src/styles.css` | CSS import order | **Modify** — append `auth-scene.css` import last |
| `frontend/src/components/ConsentGate.tsx` | Consent screen | **Modify** — render `<AuthScene />` |
| `frontend/src/App.tsx` | Auth screens | **Modify** — render `<AuthScene />`, drop inline `<StorybookScene />`, swap import |

---

## Task 1: AuthScene component + styles

**Files:**
- Create: `frontend/src/components/AuthScene.tsx`
- Create: `frontend/src/styles/auth-scene.css`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/AuthScene.tsx`:

```tsx
import companionIcon from "../assets/storybook-icons/companion.png";

/**
 * Full-screen lively background for the consent / auth screens.
 * Pure decoration (aria-hidden). Rendered as a sibling BEFORE the glass panel
 * so the panel's backdrop-filter can blur it. Position: fixed (see auth-scene.css).
 */
export function AuthScene() {
  return (
    <div className="auth-scene" aria-hidden="true">
      <span className="auth-scene-blob blob-a" />
      <span className="auth-scene-blob blob-b" />
      <span className="auth-scene-blob blob-c" />
      <span className="auth-scene-star star-a" />
      <span className="auth-scene-star star-b" />
      <span className="auth-scene-star star-c" />
      <span className="auth-scene-mark">
        <img src={companionIcon} alt="" />
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create the stylesheet**

Create `frontend/src/styles/auth-scene.css`:

```css
/* Full-screen lively background for consent / auth screens + frosted-glass panels. */

.auth-scene {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background:
    radial-gradient(120% 90% at 15% 8%, rgba(255, 231, 209, 0.92), transparent 60%),
    radial-gradient(120% 90% at 85% 18%, rgba(213, 240, 224, 0.92), transparent 60%),
    linear-gradient(160deg, #fff7ee 0%, #f1faf2 55%, #eaf5ee 100%);
}

.auth-scene-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(42px);
  opacity: 0.55;
  will-change: transform;
}

.auth-scene-blob.blob-a {
  width: 300px;
  height: 300px;
  top: -64px;
  left: -48px;
  background: radial-gradient(circle, rgba(255, 198, 160, 0.8), transparent 70%);
  animation: authBlobFloat 18s ease-in-out infinite;
}

.auth-scene-blob.blob-b {
  width: 340px;
  height: 340px;
  right: -72px;
  bottom: -88px;
  background: radial-gradient(circle, rgba(150, 210, 175, 0.7), transparent 70%);
  animation: authBlobFloat 22s ease-in-out infinite reverse;
}

.auth-scene-blob.blob-c {
  width: 220px;
  height: 220px;
  top: 42%;
  left: 58%;
  background: radial-gradient(circle, rgba(255, 224, 178, 0.6), transparent 70%);
  animation: authBlobFloat 26s ease-in-out infinite;
}

.auth-scene-star {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.9);
  animation: authStarTwinkle 4s ease-in-out infinite;
}

.auth-scene-star.star-a { top: 18%; left: 24%; }
.auth-scene-star.star-b { top: 26%; right: 22%; animation-delay: 1.2s; }
.auth-scene-star.star-c { top: 62%; left: 18%; animation-delay: 2.1s; }

.auth-scene-mark {
  position: absolute;
  top: 11%;
  left: 50%;
  width: 92px;
  transform: translateX(-50%);
  opacity: 0.92;
  animation: authMarkBob 6s ease-in-out infinite;
}

.auth-scene-mark img {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 10px 18px rgba(90, 70, 40, 0.18));
}

@keyframes authBlobFloat {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(22px, -26px) scale(1.08); }
}

@keyframes authStarTwinkle {
  0%, 100% { opacity: 0.25; transform: scale(0.8); }
  50% { opacity: 0.9; transform: scale(1.1); }
}

@keyframes authMarkBob {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(-10px); }
}

@media (prefers-reduced-motion: reduce) {
  .auth-scene-blob,
  .auth-scene-star,
  .auth-scene-mark {
    animation: none !important;
  }
}

/* Containers become the stacking context; the fixed scene shows through. */
.auth-shell {
  position: relative;
  background: #f3f7f2;
}

.consent-gate-backdrop {
  background: #f3f7f2;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

/* Panels → frosted glass, above the scene. */
.auth-shell .auth-panel,
.consent-gate-backdrop .consent-gate-card {
  position: relative;
  z-index: 1;
  border: 1px solid rgba(255, 255, 255, 0.6);
  background: rgba(255, 253, 250, 0.62);
  box-shadow: 0 24px 60px rgba(80, 74, 54, 0.18);
  -webkit-backdrop-filter: blur(18px) saturate(1.1);
  backdrop-filter: blur(18px) saturate(1.1);
}

.auth-shell .auth-panel {
  border-radius: 22px;
}

/* Old inline panel decoration is now provided full-screen by AuthScene. */
.auth-shell .auth-panel::before {
  display: none;
}
```

- [ ] **Step 3: Import the stylesheet last**

In `frontend/src/styles.css`, find the last import:

```css
@import "./styles/consent.css";
```

Add immediately after it:

```css
@import "./styles/auth-scene.css";
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS. `AuthScene` is exported but not yet used — fine.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AuthScene.tsx frontend/src/styles/auth-scene.css frontend/src/styles.css
git commit -m "feat(auth): full-screen lively AuthScene background + glass panel styles

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Use AuthScene in the consent screen

**Files:**
- Modify: `frontend/src/components/ConsentGate.tsx`

- [ ] **Step 1: Import AuthScene**

In `frontend/src/components/ConsentGate.tsx`, find:

```tsx
import { LegalDocModal } from "./LegalDocModal";
```

Add after it:

```tsx
import { AuthScene } from "./AuthScene";
```

- [ ] **Step 2: Render the scene as the first child of the backdrop**

In `frontend/src/components/ConsentGate.tsx`, find:

```tsx
    <div className="consent-gate-backdrop" role="dialog" aria-modal="true" aria-labelledby="consent-gate-title">
      <div className="consent-gate-card">
```

Replace it with:

```tsx
    <div className="consent-gate-backdrop" role="dialog" aria-modal="true" aria-labelledby="consent-gate-title">
      <AuthScene />
      <div className="consent-gate-card">
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ConsentGate.tsx
git commit -m "feat(auth): full-screen lively background on consent screen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Use AuthScene across the login/auth screens

**Files:**
- Modify: `frontend/src/App.tsx` (StorybookScene import; 4 auth blocks ~6315-6470)

- [ ] **Step 1: Swap the StorybookScene import for AuthScene**

In `frontend/src/App.tsx`, find the StorybookScene import (confirm exact text with `grep -n "StorybookScene\"" frontend/src/App.tsx`):

```tsx
import { StorybookScene } from "./components/StorybookScene";
```

Replace it with:

```tsx
import { AuthScene } from "./components/AuthScene";
```

- [ ] **Step 2: Add `<AuthScene />` to all four auth blocks**

In `frontend/src/App.tsx`, replace **all occurrences** of:

```tsx
      <main className="app-shell auth-shell">
        {systemWeakNoticeView}
```

with:

```tsx
      <main className="app-shell auth-shell">
        <AuthScene />
        {systemWeakNoticeView}
```

(Use the Edit tool with `replace_all: true` — this pattern is identical in all four auth-screen returns.)

- [ ] **Step 3: Remove the inline `<StorybookScene />` from the panels**

In `frontend/src/App.tsx`, remove **all occurrences** of this line (it appears four times, once per auth panel):

```tsx
          <StorybookScene />
```

(Use the Edit tool with `replace_all: true`, replacing it with an empty string. The companion brand-mark inside the onboarding panels uses a separate `companionIcon` import and is unaffected.)

- [ ] **Step 4: Confirm StorybookScene is no longer referenced**

Run: `grep -n "StorybookScene" frontend/src/App.tsx`
Expected: no output (import swapped, all four usages removed). `frontend/src/components/StorybookScene.tsx` is left in place but unused — that is fine.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS (no TypeScript errors; no unused `StorybookScene` import remaining).

- [ ] **Step 6: Smoke test**

Run: `npm run smoke:frontend`
Expected: PASS — the unauthenticated state still exposes `.auth-panel` (the smoke selector), now over the full-screen scene.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(auth): full-screen lively background across login/onboarding states

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 2: Smoke**

Run: `npm run smoke:frontend`
Expected: PASS on all viewports.

- [ ] **Step 3: Manual checklist (dev server / device)**

- Consent screen and login screen show a **full-screen** warm aurora background (no plain centered-block-on-flat look).
- Soft blobs drift, the companion mark gently bobs, stars twinkle.
- The form / consent card is a **frosted-glass** panel centered over the scene.
- checking / login / onboarding states all share the look.
- With OS "reduce motion" on, the scene is static (no animation), still looks good.
- Various sizes incl. notch safe areas: no overflow, panel readable, scene fills edge-to-edge.

- [ ] **Step 4: Commit any final tweaks**

If the manual pass required no changes, nothing to commit. Otherwise commit and re-run Steps 1–2.

---

## Self-Review (completed by plan author)

- **Spec coverage:** §2 AuthScene (aurora + blobs + storybook accents + reduced-motion, pure CSS, reuses companion.png) → Task 1; §3 consent glass + scene → Task 1 (glass override) + Task 2; §4 all auth states + keep `.auth-panel` + drop inline StorybookScene → Task 1 (override) + Task 3; §5 reconcile old `.auth-panel` decoration → Task 1 (override + `::before { display:none }`); §6 build/smoke/manual → Tasks 3–4. All covered.
- **Placeholder scan:** No TBD/TODO; complete component + CSS provided; commands have expected output.
- **Type/name consistency:** Component `AuthScene` (no props) is imported and rendered identically in ConsentGate and App.tsx. CSS classes `auth-scene`, `auth-scene-blob`(`blob-a/b/c`), `auth-scene-star`(`star-a/b/c`), `auth-scene-mark` match between `AuthScene.tsx` and `auth-scene.css`. Override selectors target existing classes `auth-shell`, `auth-panel`, `consent-gate-backdrop`, `consent-gate-card`.
- **Stacking/`backdrop-filter` safety:** `.auth-scene` is `position: fixed; z-index: 0`; panels are `position: relative; z-index: 1` siblings → panel renders above and blurs the scene behind. Scene is added as a sibling (not a child) of each panel.
- **Smoke safety:** `.auth-panel` class retained; smoke selector still resolves.
- **Known minor:** `StorybookScene.tsx` becomes an unused file (left in place); `.storybook-scene` CSS rules become dead but harmless. Not a blocker.
