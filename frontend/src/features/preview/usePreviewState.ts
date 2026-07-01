// 全屏媒体预览(附件大图/视频查看器 + 相册项左右滑动轮播)子系统的状态与逻辑。
//
// 从 App.tsx 这个巨型组件里原样抽出 preview 一族的 state / refs / effect / 处理函数,
// 行为与抽出前逐字节一致——只是搬家,不改运行时语义。预览浮层的 JSX 已抽进 screens/PreviewOverlay.tsx。
//
// 调用约定:App.tsx 在 `canCaregive` 之后、且**必须在 useAlbumState 之前**调用本 hook,把返回值解构回
// 与原来同名的局部变量。为什么排在 useAlbumState 之前:useAlbumState **消费**预览态——它接收
// setPreviewAlbumItem / setPreviewAttachment / previewAlbumItemsRef,并**产出** previewAlbumIndex /
// previewCarouselItems。故预览态(state + 全部 preview refs,含 previewAlbumItemsRef)必须由本 hook 先
// 产出,再喂给 useAlbumState;二者构成「预览态 → album → 预览派生值」的单向链,本 hook 处于链首。
//
// 依赖注入:本 hook **无任何外部依赖**。所有预览处理函数只读写本 hook 自持的 state / setter / refs——
// 它们不 persist、不读 canCaregive、不调用 album 的 editAlbumItem/removeAlbumItem(那两个「编辑/删除」动作
// 挂在 PreviewOverlay 组件里、由 App 经稳定 handler 包透传,不在本 hook)。因此本 hook 不需要 records 那种
// `deps` / `lateRef` 注入。
//
// 与 records/album 抽取的偏差(有意留在 App.tsx,因它们反向依赖 useAlbumState 的产出、需作为响应式 effect 依赖):
//  1) `previewAlbumItemsRef.current = albumPreviewItems` 的同步 effect——把 album 产出的可预览列表写进本 hook
//     返回的共享 ref(供 findAdjacentPreviewAlbumItem 读);读的是 useAlbumState 的输出,留在 App。
//  2) 相邻页预加载 effect——读 albumPreviewItems / previewAlbumIndex(均为 useAlbumState 输出),留在 App。
// 这两块都读本 hook 返回的 ref / 状态,语义不变。
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { captureBaseOffset, resolveSwipeOutcome } from "../../components/previewSwipeMath";
import type { AlbumItem, Attachment } from "../../types";

export type PreviewMotion = "opening" | "idle" | "closing";

// Rect of the tapped thumbnail, so the preview can morph (FLIP) out of / back
// into that exact thumbnail instead of a generic center zoom.
export type PreviewOriginRect = { top: number; left: number; width: number; height: number };
export const previewOriginFromRect = (rect: DOMRect): PreviewOriginRect => ({
  top: rect.top,
  left: rect.left,
  width: rect.width,
  height: rect.height,
});

// View Transitions API (Chromium WebView 111+, iOS 18+ WKWebView) gives a native
// container-transform morph between the tapped thumbnail and the fullscreen media.
// Older WebViews fall back to the FLIP animation.
const supportsViewTransition = (): boolean =>
  typeof document !== "undefined" &&
  typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === "function";

export const PREVIEW_VT = supportsViewTransition();

const startViewTransition = (callback: () => void): { finished: Promise<unknown> } => {
  const vt = (
    document as unknown as {
      startViewTransition: (cb: () => void) => { finished: Promise<unknown>; skipTransition?: () => void };
    }
  ).startViewTransition(callback);
  // 看门狗:VT 偶发挂起时整页被伪元素层盖住、所有交互被吞(线上「点开卡在过渡态然后卡死」)。
  // 动画名义时长 ~350ms,800ms 未结案就强制跳过,UI 立即落到终态,页面绝不允许卡死。
  const watchdog = window.setTimeout(() => {
    try {
      vt.skipTransition?.();
    } catch {
      // skip 失败也无碍:finished 仍会由浏览器结案或被下一次交互覆盖。
    }
  }, 800);
  void vt.finished.finally(() => window.clearTimeout(watchdog));
  return vt;
};

export function usePreviewState() {
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [previewAlbumItem, setPreviewAlbumItem] = useState<AlbumItem | null>(null);
  const [previewMotion, setPreviewMotion] = useState<PreviewMotion>("idle");
  const [previewOriginRect, setPreviewOriginRect] = useState<PreviewOriginRect | null>(null);
  const [previewActionsOpen, setPreviewActionsOpen] = useState(false);
  const [previewTransform, setPreviewTransform] = useState({ scale: 1, x: 0, y: 0 });

  const previewPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const previewLastPointRef = useRef({ x: 0, y: 0 });
  const previewPinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const previewSwipeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    velocityX: number;
    baseOffset: number;
  } | null>(null);
  const previewDragOffsetRef = useRef(0);
  const previewTapGuardRef = useRef(false);
  const previewCarouselTrackRef = useRef<HTMLDivElement | null>(null);
  const previewSwipeSettleTimerRef = useRef<number | null>(null);
  // 进行中的翻页(动画未 settle):被新手势抓住时必须先「落账」该次翻页,否则连续快滑会被吞张。
  const previewPendingPageRef = useRef<{ item: AlbumItem; attachment: Attachment; direction: 1 | -1 } | null>(null);
  const previewSwipeSettleCleanupRef = useRef<(() => void) | null>(null);
  const previewAlbumItemsRef = useRef<AlbumItem[]>([]);
  const previewAlbumItemRef = useRef<AlbumItem | null>(null);
  const previewOpenTimerRef = useRef<number | null>(null);
  const previewCloseTimerRef = useRef<number | null>(null);
  const previewVideoCleanupRef = useRef<(() => void) | null>(null);

  const clearPreviewTimers = useCallback(() => {
    if (previewOpenTimerRef.current !== null) {
      window.clearTimeout(previewOpenTimerRef.current);
      previewOpenTimerRef.current = null;
    }
    if (previewCloseTimerRef.current !== null) {
      window.clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }
    if (previewSwipeSettleTimerRef.current !== null) {
      window.clearTimeout(previewSwipeSettleTimerRef.current);
      previewSwipeSettleTimerRef.current = null;
    }
    previewSwipeSettleCleanupRef.current?.();
    previewSwipeSettleCleanupRef.current = null;
  }, []);

  const setPreviewCarouselTransform = useCallback((offsetPx = 0, animated = false, durationMs = 220) => {
    const track = previewCarouselTrackRef.current;
    if (!track) return;
    const stableOffset = Math.abs(offsetPx) < 0.4 ? 0 : offsetPx;
    const offsetText = Math.abs(stableOffset).toFixed(2);
    const offsetExpression = stableOffset >= 0 ? `+ ${offsetText}px` : `- ${offsetText}px`;
    if (animated) {
      // transition 从 none 切换到有值时,必须强制 reflow 把当前位置先落地,否则浏览器把
      // 「设 transition + 设新 transform」合并进同一帧 → 过渡完全不播、画面瞬移(无 transitionend,
      // settle 只能等兜底超时,期间手势全乱)。
      void track.offsetWidth;
      // iOS 风格减速长尾(easeOutQuint 近似):后段时间走极少路程,产生「明显减速后停住」的丝滑感。
      track.style.transition = `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    } else {
      track.style.transition = "none";
    }
    track.style.transform = `translate3d(calc(-100vw ${offsetExpression}), 0, 0)`;
  }, []);

  const resetPreviewCarouselTransform = useCallback(() => {
    previewDragOffsetRef.current = 0;
    setPreviewCarouselTransform(0, false);
  }, [setPreviewCarouselTransform]);

  const preloadPreviewAttachment = useCallback(async (attachment: Attachment) => {
    if (attachment.kind !== "image" || !attachment.url) return;
    await new Promise<void>((resolve) => {
      const image = new window.Image();
      const finish = () => {
        if (typeof image.decode === "function") {
          image.decode().then(() => resolve()).catch(() => resolve());
          return;
        }
        resolve();
      };
      image.onload = finish;
      image.onerror = () => resolve();
      image.src = attachment.url ?? "";
      if (image.complete) finish();
    });
  }, []);

  const openPreviewAttachment = useCallback((attachment: Attachment, albumItem?: AlbumItem | null, motion: PreviewMotion = "opening", origin: PreviewOriginRect | null = null) => {
    clearPreviewTimers();
    previewPointersRef.current.clear();
    previewPinchRef.current = null;
    previewSwipeRef.current = null;
    previewTapGuardRef.current = false;
    resetPreviewCarouselTransform();
    previewAlbumItemRef.current = albumItem ?? null;
    setPreviewTransform({ scale: 1, x: 0, y: 0 });
    setPreviewAlbumItem(albumItem ?? null);
    setPreviewAttachment(attachment);
    setPreviewOriginRect(origin);
    setPreviewMotion(motion);
    if (motion !== "opening") return;
    previewOpenTimerRef.current = window.setTimeout(() => {
      setPreviewMotion("idle");
      previewOpenTimerRef.current = null;
    }, 260);
  }, [clearPreviewTimers, resetPreviewCarouselTransform]);

  // openAlbumPreview 已抽到 useAlbumState(album tile tap → PhotoSwipe 全屏预览)。

  const closePreviewAttachment = useCallback(() => {
    clearPreviewTimers();
    previewPointersRef.current.clear();
    previewPinchRef.current = null;
    previewSwipeRef.current = null;
    previewTapGuardRef.current = false;
    resetPreviewCarouselTransform();
    setPreviewTransform({ scale: 1, x: 0, y: 0 });

    const finalize = () => {
      setPreviewAttachment(null);
      setPreviewAlbumItem(null);
      previewAlbumItemRef.current = null;
      setPreviewMotion("idle");
    };

    if (PREVIEW_VT) {
      // Morph the fullscreen media back into its thumbnail (if it's on screen).
      const itemId = previewAlbumItemRef.current?.id;
      const tileEl =
        itemId && typeof document !== "undefined"
          ? (document.querySelector(`[data-vt-item="${itemId}"]`) as HTMLElement | null)
          : null;
      const onScreen =
        !!tileEl &&
        (() => {
          const r = tileEl.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
        })();
      if (tileEl && onScreen) tileEl.style.viewTransitionName = "preview-media";
      const vt = startViewTransition(() => {
        flushSync(finalize);
      });
      vt.finished.finally(() => {
        if (tileEl) tileEl.style.viewTransitionName = "";
      });
      return;
    }

    setPreviewMotion("closing");
    previewCloseTimerRef.current = window.setTimeout(() => {
      finalize();
      previewCloseTimerRef.current = null;
    }, 240);
  }, [clearPreviewTimers, resetPreviewCarouselTransform]);

  const handlePreviewClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("figcaption, video, button")) return;
    if (previewTapGuardRef.current) {
      previewTapGuardRef.current = false;
      return;
    }
    closePreviewAttachment();
  }, [closePreviewAttachment]);

  useEffect(() => {
    setPreviewActionsOpen(false);
  }, [previewAlbumItem?.id, previewAttachment?.id]);

  useEffect(() => {
    if (!previewActionsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".media-preview-menu")) return;
      setPreviewActionsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [previewActionsOpen]);

  const findAdjacentPreviewAlbumItem = useCallback((direction: -1 | 1) => {
    const items = previewAlbumItemsRef.current;
    const current = previewAlbumItemRef.current;
    if (!current || !items.length) return null;
    const currentIndex = items.findIndex((item) => item.id === current.id);
    if (currentIndex < 0) return null;
    const nextItem = items[currentIndex + direction];
    return nextItem?.attachment?.url ? nextItem : null;
  }, []);

  const showAdjacentPreviewAlbumItem = useCallback((direction: -1 | 1) => {
    const nextItem = findAdjacentPreviewAlbumItem(direction);
    if (!nextItem?.attachment?.url) return false;
    void preloadPreviewAttachment(nextItem.attachment).then(() => {
      previewPointersRef.current.clear();
      previewPinchRef.current = null;
      previewSwipeRef.current = null;
      previewAlbumItemRef.current = nextItem;
      setPreviewTransform({ scale: 1, x: 0, y: 0 });
      setPreviewAlbumItem(nextItem);
      setPreviewAttachment(nextItem.attachment as Attachment);
      setPreviewMotion("idle");
    });
    return true;
  }, [findAdjacentPreviewAlbumItem, preloadPreviewAttachment]);

  const bindPreviewVideo = useCallback(
    (node: HTMLVideoElement | null) => {
      previewVideoCleanupRef.current?.();
      previewVideoCleanupRef.current = null;
      if (!node) return;
      const closeAfterNativeFullscreen = () => closePreviewAttachment();
      const closeAfterStandardFullscreen = () => {
        if (!document.fullscreenElement) closePreviewAttachment();
      };
      node.addEventListener("webkitendfullscreen", closeAfterNativeFullscreen);
      document.addEventListener("fullscreenchange", closeAfterStandardFullscreen);
      node.muted = false;
      previewVideoCleanupRef.current = () => {
        node.pause();
        node.removeEventListener("webkitendfullscreen", closeAfterNativeFullscreen);
        document.removeEventListener("fullscreenchange", closeAfterStandardFullscreen);
      };
    },
    [closePreviewAttachment],
  );

  const previewDistance = (points: Array<{ x: number; y: number }>) => {
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const dampPreviewSwipeOffset = (deltaX: number, hasAdjacent: boolean) => {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
    const sign = Math.sign(deltaX) || 1;
    const distance = Math.abs(deltaX);
    if (!hasAdjacent) {
      const resisted = viewportWidth * 0.22 * (1 - Math.exp(-distance / (viewportWidth * 0.26)));
      return sign * resisted;
    }
    // 有相邻图时 1:1 完全跟手(iOS 相册手感);此前的递增摩擦让手指与画面脱节,是「阻尼生硬」主因。
    return sign * Math.min(viewportWidth, distance);
  };

  // 把「进行中的翻页」立即落账(切换 item/attachment 等状态);返回该次翻页信息,无则 null。
  const commitPendingPreviewPage = () => {
    const pending = previewPendingPageRef.current;
    if (!pending) return null;
    previewPendingPageRef.current = null;
    previewPointersRef.current.clear();
    previewPinchRef.current = null;
    previewSwipeRef.current = null;
    previewAlbumItemRef.current = pending.item;
    setPreviewTransform({ scale: 1, x: 0, y: 0 });
    setPreviewAlbumItem(pending.item);
    setPreviewAttachment(pending.attachment);
    setPreviewMotion("idle");
    return pending;
  };

  const beginPreviewSwipe = (event: React.PointerEvent<HTMLElement>) => {
    if (!previewAlbumItemRef.current || previewTransform.scale > 1.05) return;
    previewSwipeSettleTimerRef.current && window.clearTimeout(previewSwipeSettleTimerRef.current);
    previewSwipeSettleTimerRef.current = null;
    // 接管前先摘掉上一次翻页的 transitionend 监听,避免被接管的旧动画迟到触发 settle 干扰本次拖动。
    previewSwipeSettleCleanupRef.current?.();
    previewSwipeSettleCleanupRef.current = null;
    let baseOffset = 0;
    const track = previewCarouselTrackRef.current;
    if (track) {
      try {
        const matrix = new DOMMatrixReadOnly(window.getComputedStyle(track).transform);
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
        const residual = matrix.m41 + viewportWidth;
        if (previewPendingPageRef.current) {
          // 抓住「正在翻页」的画面:先把该次翻页立即落账(否则连续快滑只有最后一次生效=吞张),
          // 再把旧窗口坐标换算到新窗口(residual ± 一屏),视觉上画面原地不动、内容账目已切。
          const pending = previewPendingPageRef.current;
          flushSync(() => {
            commitPendingPreviewPage();
          });
          const carried = residual + (pending.direction > 0 ? viewportWidth : -viewportWidth);
          baseOffset = Math.max(-viewportWidth, Math.min(viewportWidth, carried));
        } else {
          // 无进行中的翻页(回弹动画/静止/settle 后竞态):残余在屏宽 2%~98% 才接管,
          // ≈±一整屏意味着「已完成、React 尚未复位窗口」,绝不能当基准。
          baseOffset = captureBaseOffset(residual, viewportWidth);
        }
      } catch {
        baseOffset = 0;
      }
    }
    previewDragOffsetRef.current = baseOffset;
    setPreviewCarouselTransform(baseOffset, false);
    previewSwipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: event.timeStamp || window.performance.now(),
      velocityX: 0,
      baseOffset,
    };
  };

  const updatePreviewSwipe = (event: React.PointerEvent<HTMLElement>) => {
    const swipe = previewSwipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    const eventTime = event.timeStamp || window.performance.now();
    const frameDeltaX = event.clientX - swipe.lastX;
    const elapsedMs = Math.max(1, eventTime - swipe.lastTime);
    swipe.velocityX = swipe.velocityX * 0.58 + (frameDeltaX / elapsedMs) * 0.42;
    swipe.lastX = event.clientX;
    swipe.lastY = event.clientY;
    swipe.lastTime = eventTime;
    const rawDeltaX = swipe.lastX - swipe.startX;
    const rawDeltaY = swipe.lastY - swipe.startY;
    // 动画中接管(baseOffset≠0)时画面已在拖拽态,跳过方向死区判定,首帧即跟手。
    if (swipe.baseOffset === 0 && (Math.abs(rawDeltaX) < 3 || Math.abs(rawDeltaX) < Math.abs(rawDeltaY) * 0.8)) return;
    if (Math.abs(rawDeltaX) > 8 || Math.abs(rawDeltaY) > 8) previewTapGuardRef.current = true;
    if (event.cancelable) event.preventDefault();
    const combinedDeltaX = swipe.baseOffset + rawDeltaX;
    const direction = combinedDeltaX < 0 ? 1 : -1;
    const hasAdjacent = Boolean(findAdjacentPreviewAlbumItem(direction));
    const offset = dampPreviewSwipeOffset(combinedDeltaX, hasAdjacent);
    previewDragOffsetRef.current = offset;
    setPreviewCarouselTransform(offset, false);
  };

  const finishPreviewSwipe = (event: React.PointerEvent<HTMLElement>) => {
    const swipe = previewSwipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    previewSwipeRef.current = null;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
    const outcome = resolveSwipeOutcome({
      baseOffset: swipe.baseOffset,
      fingerDeltaX: swipe.lastX - swipe.startX,
      fingerDeltaY: swipe.lastY - swipe.startY,
      velocityX: swipe.velocityX,
      viewportWidth,
      hasAdjacent: (dir) => Boolean(findAdjacentPreviewAlbumItem(dir)?.attachment?.url),
    });
    // 时长不随手速缩短:快甩靠曲线前段陡峭衔接手速,减速长尾保持完整(此前「越快越短」产生急停感)。
    const durationMs = 480;
    if (outcome.action === "snap") {
      setPreviewCarouselTransform(0, true, 420);
      return;
    }
    const direction = outcome.direction;
    const nextItem = findAdjacentPreviewAlbumItem(direction);
    if (!nextItem?.attachment?.url) {
      setPreviewCarouselTransform(0, true, 420);
      return;
    }
    const nextAttachment = nextItem.attachment;
    previewTapGuardRef.current = true;
    previewPendingPageRef.current = { item: nextItem, attachment: nextAttachment, direction };
    setPreviewCarouselTransform(direction > 0 ? -viewportWidth : viewportWidth, true, durationMs);
    void preloadPreviewAttachment(nextAttachment);
    let settled = false;
    const track = previewCarouselTrackRef.current;
    const settle = () => {
      if (settled) return;
      settled = true;
      previewSwipeSettleCleanupRef.current?.();
      previewSwipeSettleCleanupRef.current = null;
      commitPendingPreviewPage();
      previewSwipeSettleTimerRef.current = null;
    };
    if (track) {
      const handleTransitionEnd = (transitionEvent: TransitionEvent) => {
        if (transitionEvent.target === track && transitionEvent.propertyName === "transform") settle();
      };
      track.addEventListener("transitionend", handleTransitionEnd);
      previewSwipeSettleCleanupRef.current = () => {
        track.removeEventListener("transitionend", handleTransitionEnd);
        if (previewSwipeSettleTimerRef.current !== null) {
          window.clearTimeout(previewSwipeSettleTimerRef.current);
          previewSwipeSettleTimerRef.current = null;
        }
      };
    }
    previewSwipeSettleTimerRef.current = window.setTimeout(settle, durationMs + 120);
  };

  const onPreviewStagePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("figcaption, button")) return;
    beginPreviewSwipe(event);
  };

  const onPreviewStagePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    updatePreviewSwipe(event);
  };

  const onPreviewStagePointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    finishPreviewSwipe(event);
  };

  const onPreviewImagePointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    beginPreviewSwipe(event);
    const point = { x: event.clientX, y: event.clientY };
    previewPointersRef.current.set(event.pointerId, point);
    previewLastPointRef.current = point;
    const points = Array.from(previewPointersRef.current.values());
    if (points.length >= 2) {
      previewPinchRef.current = {
        distance: previewDistance(points),
        scale: previewTransform.scale,
      };
    }
  };

  const onPreviewImagePointerMove = (event: React.PointerEvent<HTMLImageElement>) => {
    if (!previewPointersRef.current.has(event.pointerId)) return;
    event.stopPropagation();
    updatePreviewSwipe(event);
    const point = { x: event.clientX, y: event.clientY };
    previewPointersRef.current.set(event.pointerId, point);
    const points = Array.from(previewPointersRef.current.values());
    if (points.length >= 2 && previewPinchRef.current) {
      const distance = previewDistance(points);
      if (!distance || !previewPinchRef.current.distance) return;
      const nextScale = Math.min(4, Math.max(1, previewPinchRef.current.scale * (distance / previewPinchRef.current.distance)));
      setPreviewTransform((current) => ({
        ...current,
        scale: nextScale,
        x: nextScale === 1 ? 0 : current.x,
        y: nextScale === 1 ? 0 : current.y,
      }));
      return;
    }
    if (points.length === 1 && previewTransform.scale > 1) {
      const last = previewLastPointRef.current;
      const deltaX = point.x - last.x;
      const deltaY = point.y - last.y;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) previewTapGuardRef.current = true;
      previewLastPointRef.current = point;
      setPreviewTransform((current) => ({
        ...current,
        x: current.x + deltaX,
        y: current.y + deltaY,
      }));
    }
  };

  const onPreviewImagePointerEnd = (event: React.PointerEvent<HTMLImageElement>) => {
    event.stopPropagation();
    finishPreviewSwipe(event);
    previewPointersRef.current.delete(event.pointerId);
    previewPinchRef.current = null;
    const [remaining] = Array.from(previewPointersRef.current.values());
    if (remaining) previewLastPointRef.current = remaining;
  };

  useLayoutEffect(() => {
    previewPointersRef.current.clear();
    previewPinchRef.current = null;
    setPreviewTransform({ scale: 1, x: 0, y: 0 });
    resetPreviewCarouselTransform();
    return () => {
      previewVideoCleanupRef.current?.();
      previewVideoCleanupRef.current = null;
    };
  }, [previewAttachment?.id, previewAlbumItem?.id, resetPreviewCarouselTransform]);

  useEffect(() => {
    previewAlbumItemRef.current = previewAlbumItem;
  }, [previewAlbumItem]);

  useEffect(
    () => () => {
      clearPreviewTimers();
    },
    [clearPreviewTimers],
  );

  useEffect(() => {
    if (!previewAttachment) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreviewAttachment();
        return;
      }
      if (event.key === "ArrowLeft") {
        if (showAdjacentPreviewAlbumItem(-1)) event.preventDefault();
        return;
      }
      if (event.key === "ArrowRight") {
        if (showAdjacentPreviewAlbumItem(1)) event.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePreviewAttachment, previewAttachment, showAdjacentPreviewAlbumItem]);

  return {
    previewAttachment,
    setPreviewAttachment,
    previewAlbumItem,
    setPreviewAlbumItem,
    previewMotion,
    previewOriginRect,
    previewActionsOpen,
    setPreviewActionsOpen,
    previewTransform,
    previewAlbumItemsRef,
    previewCarouselTrackRef,
    openPreviewAttachment,
    closePreviewAttachment,
    handlePreviewClick,
    bindPreviewVideo,
    onPreviewStagePointerDown,
    onPreviewStagePointerMove,
    onPreviewStagePointerEnd,
    onPreviewImagePointerDown,
    onPreviewImagePointerMove,
    onPreviewImagePointerEnd,
  };
}

// previewAlbumItemRef 不进返回值:仅本 hook 内部使用(findAdjacent / open / close / settle 读写),
// App 侧不需要。若将来 App 需要读它,再加进返回值。
