// Coordinates album tile video playback so only ONE video — the one closest to
// the viewport center — plays at a time. This caps concurrent video decodes to 1,
// which keeps scrolling smooth on low-end Android (multiple simultaneous decodes
// were the main source of jank). Uses a single shared IntersectionObserver plus a
// throttled scroll/resize listener instead of one observer per tile.

type Entry = { el: HTMLVideoElement; visible: boolean };

const entries = new Set<Entry>();
let observer: IntersectionObserver | null = null;
let listenersBound = false;
let frameScheduled = false;

const update = () => {
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const center = viewportHeight / 2;
  let best: Entry | null = null;
  let bestDistance = Infinity;
  for (const entry of entries) {
    if (!entry.visible) continue;
    const rect = entry.el.getBoundingClientRect();
    const elementCenter = rect.top + rect.height / 2;
    const distance = Math.abs(elementCenter - center);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry;
    }
  }
  for (const entry of entries) {
    if (entry === best) {
      if (entry.el.paused) void entry.el.play().catch(() => {});
    } else if (!entry.el.paused) {
      entry.el.pause();
    }
  }
};

const schedule = () => {
  if (frameScheduled) return;
  frameScheduled = true;
  requestAnimationFrame(() => {
    frameScheduled = false;
    update();
  });
};

const ensureGlobals = () => {
  if (!observer && typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          for (const entry of entries) {
            if (entry.el === record.target) {
              entry.visible = record.isIntersecting && record.intersectionRatio >= 0.25;
            }
          }
        }
        schedule();
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
  }
  if (!listenersBound && typeof window !== "undefined") {
    // capture: true so scroll from the album's inner scroll container reaches us
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule, { passive: true });
    listenersBound = true;
  }
};

/** Register an album tile <video>; only the most-centered visible one plays. Returns an unregister fn. */
export const registerAlbumVideo = (el: HTMLVideoElement): (() => void) => {
  ensureGlobals();
  const entry: Entry = { el, visible: false };
  entries.add(entry);
  observer?.observe(el);
  schedule();
  return () => {
    observer?.unobserve(el);
    entries.delete(entry);
    if (!el.paused) el.pause();
    schedule();
  };
};
