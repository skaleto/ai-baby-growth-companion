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

// 全屏预览打开期间挂起网格自动播放:被 PhotoSwipe 盖住的网格视频在底下继续解码,
// 会直接拖低预览滑动帧率(IntersectionObserver 感知不到遮挡)。
let suspended = false;

export const suspendAlbumVideos = (): void => {
  suspended = true;
  for (const entry of entries) {
    if (!entry.el.paused) entry.el.pause();
  }
};

export const resumeAlbumVideos = (): void => {
  suspended = false;
  schedule();
};

const update = () => {
  if (suspended) return;
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

// Warm the HTTP cache for a video the user is about to open (pressed its tile),
// so the fullscreen player reuses the bytes instead of starting a cold load.
const prefetched = new Set<string>();
export const prefetchAlbumVideo = (url: string | undefined | null): void => {
  if (!url || prefetched.has(url) || typeof document === "undefined") return;
  prefetched.add(url);
  const warm = document.createElement("video");
  warm.muted = true;
  warm.preload = "auto";
  warm.src = url;
  try {
    warm.load();
  } catch {
    /* ignore */
  }
  // Release after a short while; Cache-Control keeps the fetched bytes around.
  window.setTimeout(() => {
    warm.removeAttribute("src");
    try {
      warm.load();
    } catch {
      /* ignore */
    }
  }, 8000);
};

// 观察器的 root 必须是真正的滚动容器:root:null(视口)时,目标会先被内层
// overflow 容器裁剪,rootMargin 形同虚设——视口外的 tile 永远「不相交」,
// 预挂载余量失效(D3 排查发现;视频 320px 余量此前同样未生效)。
// 按「目标最近的可滚动祖先」解析 root,并按 root 分别建观察器。
const scrollRootCache = new WeakMap<Element, Element | null>();

function scrollRootOf(el: Element): Element | null {
  const parent = el.parentElement;
  if (!parent) return null;
  const cached = scrollRootCache.get(parent);
  if (cached !== undefined) return cached;
  let node: Element | null = parent;
  let result: Element | null = null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      result = node;
      break;
    }
    node = node.parentElement;
  }
  scrollRootCache.set(parent, result);
  return result;
}

// 「接近视口才挂 <video>」的共享观察器:N 个视频 tile 同时初始化解码器/拉元数据是
// 相册打开卡顿与冷启动开销的大头;离屏 tile 只渲染海报,进入视口前 320px 才换真视频。
const nearObservers = new Map<Element | null, IntersectionObserver>();
const nearCallbacks = new Map<Element, { onNear: () => void; observer: IntersectionObserver }>();

export const observeNearViewport = (el: Element, onNear: () => void): (() => void) => {
  if (typeof IntersectionObserver === "undefined") {
    onNear();
    return () => {};
  }
  const root = scrollRootOf(el);
  let observer = nearObservers.get(root);
  if (!observer) {
    observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (!record.isIntersecting) continue;
          const entry = nearCallbacks.get(record.target);
          if (entry) {
            nearCallbacks.delete(record.target);
            entry.observer.unobserve(record.target);
            entry.onNear();
          }
        }
      },
      { root, rootMargin: "320px 0px" },
    );
    nearObservers.set(root, observer);
  }
  nearCallbacks.set(el, { onNear, observer });
  observer.observe(el);
  return () => {
    const entry = nearCallbacks.get(el);
    nearCallbacks.delete(el);
    entry?.observer.unobserve(el);
  };
};

// 「可视窗口」双向观察(架构债 D3 相册窗口化):tile 进入滚动容器 ±150%(约两屏)挂载媒体子树,
// 离开则卸载。与 observeNearViewport(挂上后保持)不同,这里是双向的——长相册滚到哪挂到哪,
// DOM 中的媒体元素数始终 ≈ 可视区±2屏,内存与协调成本不再随相册体量线性增长。
const windowObservers = new Map<Element | null, IntersectionObserver>();
const windowCallbacks = new Map<Element, { onChange: (inWindow: boolean) => void; observer: IntersectionObserver }>();

export const observeViewportWindow = (el: Element, onChange: (inWindow: boolean) => void): (() => void) => {
  if (typeof IntersectionObserver === "undefined") {
    onChange(true);
    return () => {};
  }
  const root = scrollRootOf(el);
  let observer = windowObservers.get(root);
  if (!observer) {
    observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          windowCallbacks.get(record.target)?.onChange(record.isIntersecting);
        }
      },
      { root, rootMargin: "150% 0px" },
    );
    windowObservers.set(root, observer);
  }
  windowCallbacks.set(el, { onChange, observer });
  observer.observe(el);
  return () => {
    const entry = windowCallbacks.get(el);
    windowCallbacks.delete(el);
    entry?.observer.unobserve(el);
  };
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
